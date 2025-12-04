import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { Card, Text, Chip, IconButton, Portal, Modal, TextInput, Button, Searchbar, RadioButton, FAB, Menu, Divider } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { useNavigation } from '@react-navigation/native';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, addDoc, deleteDoc, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebaseConfig';

// --- MODAL 1: EDITAR PRODUCTO ---
const EditProductModal = ({ visible, hide, product }) => {
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [provider, setProvider] = useState('');
  const [location, setLocation] = useState('');
  const [showLocPicker, setShowLocPicker] = useState(false);
  const WAREHOUSES = ["Bodega 1", "Bodega 2", "Bodega 3", "Bodega 4", "Bodega 5", "Cámara de Frío"];

  const [stock, setStock] = useState('');
  const [minStock, setMinStock] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCatMenu, setShowCatMenu] = useState(false);
  const CATEGORIES = ["Insumos", "Grasas", "Repostería", "Lácteos", "Harinas", "Otros"];

  useEffect(() => {
    if (product) {
      setSku(product.sku || '');
      setName(product.name || '');
      setCategory(product.category || '');
      setProvider(product.provider || '');
      setLocation(product.location || product.aisle || '');
      setStock(String(product.stock || product.quantity || ''));
      setMinStock(String(product.minStock || '10'));
    }
  }, [product]);

  const handleUpdate = async () => {
    setLoading(true);
    try {
      const productRef = doc(db, "products", product.id);
      await updateDoc(productRef, {
        sku, name, category, provider,
        location, aisle: location,
        stock: parseInt(stock), quantity: parseInt(stock),
        minStock: parseInt(minStock),
        updatedAt: new Date()
      });
      hide();
      Alert.alert("Ã‰xito", "Producto actualizado.");
    } catch (e) { Alert.alert("Error", e.message); } finally { setLoading(false); }
  };

  return (
    <Portal>
      <Modal visible={visible} onDismiss={hide} contentContainerStyle={styles.modal}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
          <Text variant="headlineSmall" style={{ fontWeight: 'bold', color: '#333' }}>Editar Producto</Text>
          <IconButton icon="close" size={24} onPress={hide} />
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>SKU</Text>
            <TextInput value={sku} onChangeText={setSku} mode="outlined" style={styles.input} dense />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>CategorÃ­a</Text>
            <Menu
              visible={showCatMenu}
              onDismiss={() => setShowCatMenu(false)}
              anchor={
                <TouchableOpacity onPress={() => setShowCatMenu(true)}>
                  <TextInput value={category} mode="outlined" editable={false} right={<TextInput.Icon icon="chevron-down" />} style={styles.input} dense />
                </TouchableOpacity>
              }
            >
              {CATEGORIES.map(cat => <Menu.Item key={cat} onPress={() => { setCategory(cat); setShowCatMenu(false); }} title={cat} />)}
            </Menu>
          </View>
        </View>
        <Text style={styles.label}>Nombre</Text>
        <TextInput value={name} onChangeText={setName} mode="outlined" style={styles.input} dense />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Proveedor</Text>
            <TextInput value={provider} onChangeText={setProvider} mode="outlined" style={styles.input} dense />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Bodega</Text>
            <Menu
              visible={showLocPicker}
              onDismiss={() => setShowLocPicker(false)}
              anchor={
                <TouchableOpacity onPress={() => setShowLocPicker(true)}>
                  <TextInput value={location} mode="outlined" editable={false} right={<TextInput.Icon icon="chevron-down" />} style={styles.input} dense />
                </TouchableOpacity>
              }
            >
              {WAREHOUSES.map(wh => <Menu.Item key={wh} onPress={() => { setLocation(wh); setShowLocPicker(false); }} title={wh} />)}
            </Menu>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Stock Actual</Text>
            <TextInput value={stock} onChangeText={setStock} keyboardType="numeric" mode="outlined" style={styles.input} dense />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>MÃ­nimo</Text>
            <TextInput value={minStock} onChangeText={setMinStock} keyboardType="numeric" mode="outlined" style={styles.input} dense />
          </View>
        </View>
        <Button mode="contained" onPress={handleUpdate} loading={loading} buttonColor="#F36F21" style={{ marginTop: 20 }}>Actualizar</Button>
      </Modal>
    </Portal>
  );
};

// --- MODAL 2: REPORTAR MERMA ---
const ReportWasteModal = ({ visible, hide, product }) => {
  const [qty, setQty] = useState('');
  const [cause, setCause] = useState('Vencido');
  const [loading, setLoading] = useState(false);

  const handleConfirmWaste = async () => {
    if (!qty) return Alert.alert("Error", "Ingresa la cantidad.");
    setLoading(true);
    try {
      const deduction = parseInt(qty);
      const currentStock = product.stock || product.quantity || 0;
      if (currentStock < deduction) {
        setLoading(false);
        return Alert.alert("Error", "Stock insuficiente.");
      }
      const newStock = currentStock - deduction;
      await updateDoc(doc(db, "products", product.id), { stock: newStock, quantity: newStock });
      await addDoc(collection(db, "waste"), { sku: product.sku, productName: product.name, quantity: deduction, cause, date: new Date() });
      await addDoc(collection(db, "kardex"), { sku: product.sku, productName: product.name, type: "Salida", quantity: deduction, reason: `Merma (${cause})`, date: new Date(), user: "Bodeguero" });
      Alert.alert("Listo", `Descontadas ${deduction} un.`);
      setQty(''); hide();
    } catch (e) { Alert.alert("Error", e.message); } finally { setLoading(false); }
  };

  return (
    <Portal>
      <Modal visible={visible} onDismiss={hide} contentContainerStyle={styles.modal}>
        <Text variant="headlineSmall" style={{ marginBottom: 10, color: '#D32F2F', fontWeight: 'bold' }}>Registrar Merma</Text>
        <Text style={{ marginBottom: 15 }}>{product?.name}</Text>
        <TextInput label="Cantidad" value={qty} onChangeText={setQty} keyboardType="numeric" mode="outlined" style={styles.input} />
        <RadioButton.Group onValueChange={setCause} value={cause}>
          <View style={{ flexDirection: 'row', marginBottom: 15 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 15 }}><RadioButton value="Vencido" /><Text>Vencido</Text></View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}><RadioButton value="DaÃ±o" /><Text>DaÃ±o</Text></View>
          </View>
        </RadioButton.Group>
        <Button mode="contained" onPress={handleConfirmWaste} loading={loading} buttonColor="#D32F2F">Confirmar</Button>
        <Button mode="text" onPress={hide} style={{ marginTop: 5 }}>Cancelar</Button>
      </Modal>
    </Portal>
  );
};

// --- MODAL 3: DETALLE DE CONTEO (LINEAR WORKFLOW) ---
const CountDetailModal = ({ visible, hide, count }) => {
  const [permission, requestPermission] = useCameraPermissions();

  // Workflow Steps: 'SUMMARY' -> 'SCAN' -> 'INPUT' -> 'RESULT'
  const [step, setStep] = useState('SUMMARY');

  const [items, setItems] = useState([]);
  const [currentItem, setCurrentItem] = useState(null);
  const [countedQty, setCountedQty] = useState('');

  // Manual Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [showManualSearch, setShowManualSearch] = useState(false);

  useEffect(() => {
    if (count) {
      setItems(count.items || []);
      resetWorkflow();
    }
  }, [count]);

  useEffect(() => {
    if (step === 'SCAN' && !permission?.granted) requestPermission();
  }, [step, permission]);

  const resetWorkflow = () => {
    setStep('SUMMARY');
    setCurrentItem(null);
    setCountedQty('');
    setSearchQuery('');
    setShowManualSearch(false);
  };

  const handleStartScanning = () => setStep('SCAN');

  const handleBarCodeScanned = ({ data }) => {
    const found = items.find(i => i.sku === data);
    if (found) {
      setCurrentItem(found);
      setStep('INPUT');
    } else {
      Alert.alert("No encontrado", "El producto escaneado no pertenece a este conteo.");
    }
  };

  const handleManualSelect = (item) => {
    setCurrentItem(item);
    setStep('INPUT');
    setShowManualSearch(false);
  };

  const handleConfirmCount = () => {
    const val = parseInt(countedQty);
    if (isNaN(val)) return Alert.alert("Error", "Ingresa un nÃºmero vÃ¡lido");
    setStep('RESULT');
  };

  const handleSaveAndNext = async () => {
    const val = parseInt(countedQty);
    const updatedItems = items.map(i =>
      i.sku === currentItem.sku ? { ...i, counted: val } : i
    );

    const totalCounted = updatedItems.reduce((acc, curr) => acc + (curr.counted || 0), 0);

    try {
      await updateDoc(doc(db, "counts", count.id), {
        items: updatedItems,
        counted: totalCounted,
        status: 'Pendiente'
      });
      setItems(updatedItems);
      // Return to SUMMARY instead of SCAN loop, as per user preference for list selection
      setStep('SUMMARY');
      setCurrentItem(null);
      setCountedQty('');
    } catch (e) {
      Alert.alert("Error", "No se pudo guardar: " + e.message);
    }
  };

  const handleRetry = () => {
    setStep('INPUT');
  };

  if (!count) return null;

  // --- VIEW 1: SUMMARY ---
  if (step === 'SUMMARY') {
    const progress = items.filter(i => i.counted > 0).length;
    return (
      <Portal>
        <Modal visible={visible} onDismiss={hide} contentContainerStyle={[styles.modal, { maxHeight: '90%' }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
            <View>
              <Text variant="titleLarge" style={{ fontWeight: 'bold' }}>{count.countId}</Text>
              <Text variant="bodyMedium" style={{ color: '#666' }}>{count.worker} â€¢ {count.aisle}</Text>
            </View>
            <IconButton icon="close" size={24} onPress={hide} />
          </View>

          <View style={{ backgroundColor: '#E3F2FD', padding: 15, borderRadius: 10, marginBottom: 20 }}>
            <Text variant="titleMedium" style={{ textAlign: 'center', fontWeight: 'bold', color: '#1565C0' }}>
              Progreso: {progress} / {items.length} Productos
            </Text>
          </View>

          <Button
            mode="contained"
            icon="barcode-scan"
            buttonColor="#F36F21"
            contentStyle={{ height: 50 }}
            labelStyle={{ fontSize: 18 }}
            onPress={handleStartScanning}
            style={{ marginBottom: 10 }}
          >
            Modo Escáner
          </Button>

          <Text variant="bodySmall" style={{ textAlign: 'center', color: '#666', marginBottom: 10 }}>
            O selecciona un producto de la lista para contar:
          </Text>

          <Divider style={{ marginVertical: 10 }} />

          <Text variant="titleMedium" style={{ marginBottom: 10 }}>Resumen de Items</Text>
          <ScrollView>
            {items.map((item, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => handleManualSelect(item)}
                style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#eee', alignItems: 'center' }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16 }}>{item.name}</Text>
                  <Text variant="bodySmall" style={{ color: '#666' }}>{item.sku}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ fontWeight: 'bold', fontSize: 16, marginRight: 10, color: item.counted !== undefined ? (item.counted === item.expected ? 'green' : 'red') : '#999' }}>
                    {item.counted !== undefined ? item.counted : '-'} / {item.expected}
                  </Text>
                  <MaterialCommunityIcons name="chevron-right" size={24} color="#ccc" />
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Modal>
      </Portal>
    );
  }

  // --- VIEW 2: SCANNER ---
  if (step === 'SCAN') {
    return (
      <Portal>
        <Modal visible={visible} onDismiss={hide} contentContainerStyle={[styles.modal, { padding: 0, height: '100%', width: '100%', margin: 0 }]}>
          <View style={{ flex: 1, backgroundColor: 'black' }}>
            <CameraView style={{ flex: 1 }} facing="back" onBarcodeScanned={handleBarCodeScanned} />

            {/* Overlay UI */}
            <View style={{ position: 'absolute', top: 50, left: 20, right: 20, flexDirection: 'row', justifyContent: 'space-between' }}>
              <IconButton icon="arrow-left" iconColor="white" size={30} onPress={() => setStep('SUMMARY')} />
              <View style={{ backgroundColor: 'rgba(0,0,0,0.6)', padding: 10, borderRadius: 5 }}>
                <Text style={{ color: 'white', fontWeight: 'bold' }}>Escanea Producto</Text>
              </View>
              <View style={{ width: 40 }} />
            </View>

            <View style={{ position: 'absolute', bottom: 40, left: 20, right: 20 }}>
              <Button mode="contained" buttonColor="white" textColor="#F36F21" icon="keyboard" onPress={() => setShowManualSearch(true)}>
                Ingreso Manual
              </Button>
            </View>

            {/* Manual Search Modal (Nested) */}
            <Modal visible={showManualSearch} onDismiss={() => setShowManualSearch(false)} contentContainerStyle={{ backgroundColor: 'white', margin: 20, padding: 20, borderRadius: 10, height: '80%' }}>
              <Text variant="titleMedium" style={{ marginBottom: 10 }}>Buscar Producto</Text>
              <Searchbar placeholder="Nombre o SKU" onChangeText={setSearchQuery} value={searchQuery} style={{ marginBottom: 10, backgroundColor: '#f0f0f0' }} />
              <ScrollView>
                {items.filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()) || i.sku.includes(searchQuery)).map((item, idx) => (
                  <TouchableOpacity key={idx} onPress={() => handleManualSelect(item)} style={{ padding: 15, borderBottomWidth: 1, borderBottomColor: '#eee' }}>
                    <Text style={{ fontWeight: 'bold' }}>{item.name}</Text>
                    <Text variant="bodySmall">{item.sku}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Button onPress={() => setShowManualSearch(false)} style={{ marginTop: 10 }}>Cerrar</Button>
            </Modal>
          </View>
        </Modal>
      </Portal>
    );
  }

  // --- VIEW 3: INPUT (BLIND COUNT) ---
  if (step === 'INPUT') {
    return (
      <Portal>
        <Modal visible={visible} onDismiss={hide} contentContainerStyle={styles.modal}>
          <Text variant="headlineSmall" style={{ fontWeight: 'bold', color: '#F36F21', marginBottom: 5 }}>Ingresar Cantidad</Text>
          <Text variant="titleMedium" style={{ marginBottom: 5 }}>{currentItem.name}</Text>
          <Chip icon="barcode" style={{ alignSelf: 'flex-start', marginBottom: 20 }}>{currentItem.sku}</Chip>

          <TextInput
            label="Cantidad Contada"
            value={countedQty}
            onChangeText={setCountedQty}
            keyboardType="numeric"
            mode="outlined"
            style={{ backgroundColor: 'white', fontSize: 24, marginBottom: 20 }}
            contentStyle={{ fontSize: 24, fontWeight: 'bold' }}
            autoFocus
          />

          <Button mode="contained" onPress={handleConfirmCount} buttonColor="#F36F21" contentStyle={{ height: 50 }}>
            Confirmar
          </Button>
          <Button mode="text" onPress={() => setStep('SUMMARY')} style={{ marginTop: 10 }}>
            Cancelar
          </Button>
        </Modal>
      </Portal>
    );
  }

  // --- VIEW 4: RESULT ---
  if (step === 'RESULT') {
    const diff = parseInt(countedQty) - currentItem.expected;
    const isMatch = diff === 0;

    return (
      <Portal>
        <Modal visible={visible} onDismiss={hide} contentContainerStyle={styles.modal}>
          <View style={{ alignItems: 'center', marginBottom: 20 }}>
            <MaterialCommunityIcons name={isMatch ? "check-circle" : "alert-circle"} size={60} color={isMatch ? "#2E7D32" : "#D32F2F"} />
            <Text variant="headlineMedium" style={{ fontWeight: 'bold', marginTop: 10, color: isMatch ? "#2E7D32" : "#D32F2F" }}>
              {isMatch ? "Â¡Coincide!" : "Diferencia Detectada"}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginBottom: 20, width: '100%' }}>
            <View style={{ alignItems: 'center' }}>
              <Text variant="labelMedium">Contado</Text>
              <Text variant="displaySmall" style={{ fontWeight: 'bold' }}>{countedQty}</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text variant="labelMedium">Esperado</Text>
              <Text variant="displaySmall" style={{ fontWeight: 'bold', color: '#666' }}>{currentItem.expected}</Text>
            </View>
          </View>

          {!isMatch && (
            <View style={{ backgroundColor: '#FFEBEE', padding: 10, borderRadius: 5, marginBottom: 20, width: '100%', alignItems: 'center' }}>
              <Text style={{ color: '#D32F2F', fontWeight: 'bold' }}>Diferencia: {diff > 0 ? '+' : ''}{diff}</Text>
            </View>
          )}

          <Button mode="contained" onPress={handleSaveAndNext} buttonColor={isMatch ? "#2E7D32" : "#F36F21"} contentStyle={{ height: 50 }} style={{ marginBottom: 10 }}>
            Guardar
          </Button>

          <Button mode="outlined" onPress={handleRetry} textColor="#666">
            Corregir Cantidad
          </Button>
        </Modal>
      </Portal>
    );
  }

  return null;
};

// --- MODAL 4: CREAR NUEVO CONTEO ---
const CreateCountModal = ({ visible, hide }) => {
  const [worker, setWorker] = useState('Yohan');
  const [aisle, setAisle] = useState('');
  const [showLocPicker, setShowLocPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const WAREHOUSES = ["Bodega 1", "Bodega 2", "Bodega 3", "Bodega 4", "Bodega 5", "Cámara de Frío"];

  // Product Selection State
  const [availableProducts, setAvailableProducts] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [showProductSelector, setShowProductSelector] = useState(false);

  // Initial Quantities State (for "Count and Create")
  const [initialQuantities, setInitialQuantities] = useState({});

  // Result Screen State
  const [step, setStep] = useState('FORM'); // 'FORM' or 'RESULT'
  const [resultData, setResultData] = useState(null);

  useEffect(() => {
    if (visible) {
      setStep('FORM');
      setResultData(null);
    }
  }, [visible]);

  useEffect(() => {
    if (aisle) {
      fetchProductsForAisle();
    } else {
      setAvailableProducts([]);
      setSelectedProducts([]);
      setInitialQuantities({});
    }
  }, [aisle]);

  const fetchProductsForAisle = async () => {
    try {
      const q = query(collection(db, "products"), where("location", "==", aisle));
      const snapshot = await getDocs(q);
      const prods = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setAvailableProducts(prods);
      setSelectedProducts([]);
      setInitialQuantities({});
    } catch (e) {
      console.error(e);
    }
  };

  const toggleProductSelection = (sku) => {
    if (selectedProducts.includes(sku)) {
      setSelectedProducts(selectedProducts.filter(s => s !== sku));
      const newQty = { ...initialQuantities };
      delete newQty[sku];
      setInitialQuantities(newQty);
    } else {
      setSelectedProducts([...selectedProducts, sku]);
    }
  };

  const handleQuantityChange = (sku, text) => {
    setInitialQuantities(prev => ({ ...prev, [sku]: text }));
  };

  const resetForm = () => {
    setAisle('');
    setSelectedProducts([]);
    setInitialQuantities({});
    setStep('FORM');
    setResultData(null);
    hide();
  };

  const handleCreate = async () => {
    if (!aisle) return Alert.alert("Faltan Datos", "Selecciona la Bodega.");
    setLoading(true);
    try {
      const productsToCount = selectedProducts.length > 0
        ? availableProducts.filter(p => selectedProducts.includes(p.sku))
        : availableProducts;

      if (productsToCount.length === 0) {
        setLoading(false);
        return Alert.alert("Aviso", "No hay productos en esta bodega para contar.");
      }

      let expectedTotal = 0;
      let countedTotal = 0;

      const itemsSnapshot = productsToCount.map(data => {
        const qty = data.stock !== undefined ? data.stock : (data.quantity || 0);
        expectedTotal += qty;

        // Use initial quantity if provided (only for selected products)
        const initialQty = selectedProducts.includes(data.sku) && initialQuantities[data.sku]
          ? parseInt(initialQuantities[data.sku]) || 0
          : 0;

        countedTotal += initialQty;

        return { sku: data.sku, name: data.name, expected: qty, counted: initialQty };
      });

      const randomId = Math.floor(1000 + Math.random() * 9000);
      await addDoc(collection(db, "counts"), {
        countId: `CNT-${randomId}`,
        worker: worker,
        aisle: aisle,
        status: 'Pendiente',
        date: new Date(),
        expected: expectedTotal,
        counted: countedTotal,
        items: itemsSnapshot
      });

      // Instead of Alert, show Result Screen
      setResultData({
        countId: `CNT-${randomId}`,
        itemsCount: itemsSnapshot.length,
        expected: expectedTotal,
        counted: countedTotal
      });
      setStep('RESULT');

    } catch (e) { Alert.alert("Error", e.message); } finally { setLoading(false); }
  };

  // --- VIEW: RESULT SCREEN ---
  if (step === 'RESULT' && resultData) {
    const diff = resultData.counted - resultData.expected;
    const isMatch = diff === 0;

    return (
      <Portal>
        <Modal visible={visible} onDismiss={resetForm} contentContainerStyle={styles.modal}>
          <View style={{ alignItems: 'center', marginBottom: 20 }}>
            <MaterialCommunityIcons name={isMatch ? "check-circle" : "alert-circle"} size={60} color={isMatch ? "#2E7D32" : "#D32F2F"} />
            <Text variant="headlineMedium" style={{ fontWeight: 'bold', marginTop: 10, color: isMatch ? "#2E7D32" : "#D32F2F", textAlign: 'center' }}>
              {isMatch ? "¡Coincide!" : "Diferencia Detectada"}
            </Text>
            <Text variant="bodyMedium" style={{ marginTop: 5, color: '#666' }}>
              Conteo iniciado con {resultData.itemsCount} productos
            </Text>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginBottom: 20, width: '100%' }}>
            <View style={{ alignItems: 'center' }}>
              <Text variant="labelMedium">Contado</Text>
              <Text variant="displaySmall" style={{ fontWeight: 'bold' }}>{resultData.counted}</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text variant="labelMedium">Esperado</Text>
              <Text variant="displaySmall" style={{ fontWeight: 'bold', color: '#666' }}>{resultData.expected}</Text>
            </View>
          </View>

          {!isMatch && (
            <View style={{ backgroundColor: '#FFEBEE', padding: 10, borderRadius: 5, marginBottom: 20, width: '100%', alignItems: 'center' }}>
              <Text style={{ color: '#D32F2F', fontWeight: 'bold' }}>Diferencia: {diff > 0 ? '+' : ''}{diff}</Text>
            </View>
          )}

          <Button mode="contained" onPress={resetForm} buttonColor="#F36F21" contentStyle={{ height: 50 }} style={{ marginBottom: 10 }}>
            Guardar
          </Button>

          <Button mode="outlined" onPress={() => setStep('FORM')} textColor="#666">
            Corregir Cantidad
          </Button>
        </Modal>
      </Portal>
    );
  }

  // --- VIEW: FORM ---
  return (
    <Portal>
      <Modal visible={visible} onDismiss={hide} contentContainerStyle={[styles.modal, { maxHeight: '90%' }]}>
        <ScrollView>
          <Text variant="headlineSmall" style={{ marginBottom: 15, fontWeight: 'bold', color: '#F36F21' }}>Nuevo Conteo</Text>
          <View style={{ marginBottom: 15 }}>
            <Text style={styles.label}>Bodeguero</Text>
            <Text variant="bodyLarge" style={{ padding: 10, backgroundColor: '#f0f0f0', borderRadius: 5, color: '#555' }}>{worker}</Text>
          </View>
          <Menu
            visible={showLocPicker}
            onDismiss={() => setShowLocPicker(false)}
            anchor={
              <TouchableOpacity onPress={() => setShowLocPicker(true)}>
                <TextInput label="Bodega" value={aisle} mode="outlined" editable={false} right={<TextInput.Icon icon="chevron-down" onPress={() => setShowLocPicker(true)} />} style={styles.input} />
              </TouchableOpacity>
            }
          >
            {WAREHOUSES.map(wh => <Menu.Item key={wh} onPress={() => { setAisle(wh); setShowLocPicker(false); }} title={wh} />)}
          </Menu>

          {aisle !== '' && (
            <View>
              <Button
                mode="outlined"
                onPress={() => setShowProductSelector(true)}
                textColor="#F36F21"
                style={{ borderColor: '#F36F21', marginBottom: 10 }}
              >
                {selectedProducts.length > 0
                  ? `Seleccionados: ${selectedProducts.length} productos`
                  : "Seleccionar Productos"}
              </Button>

              {/* Initial Quantity Inputs for Selected Products */}
              {selectedProducts.length > 0 && (
                <View style={{ marginTop: 10 }}>
                  <Text variant="titleMedium" style={{ marginBottom: 10, fontWeight: 'bold' }}>Ingresar Cantidades</Text>
                  {selectedProducts.map(sku => {
                    const product = availableProducts.find(p => p.sku === sku);
                    if (!product) return null;
                    return (
                      <View key={sku} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10, justifyContent: 'space-between' }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontWeight: 'bold' }}>{product.name}</Text>
                          <Text variant="bodySmall">{product.sku}</Text>
                        </View>
                        <TextInput
                          label="Cant."
                          value={initialQuantities[sku] || ''}
                          onChangeText={(text) => handleQuantityChange(sku, text)}
                          keyboardType="numeric"
                          mode="outlined"
                          style={{ width: 100, backgroundColor: 'white' }}
                          dense
                        />
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          <Button mode="contained" onPress={handleCreate} loading={loading} buttonColor="#F36F21" style={{ marginTop: 10 }}>Iniciar Conteo</Button>
          <Button mode="text" onPress={hide} style={{ marginTop: 5 }}>Cancelar</Button>
        </ScrollView>

        {/* Product Selection Modal */}
        <Portal>
          <Modal visible={showProductSelector} onDismiss={() => setShowProductSelector(false)} contentContainerStyle={[styles.modal, { maxHeight: '80%' }]}>
            <Text variant="titleMedium" style={{ marginBottom: 10, fontWeight: 'bold' }}>Seleccionar Productos</Text>
            <Text style={{ marginBottom: 10 }}>Bodega: {aisle}</Text>
            <ScrollView>
              {availableProducts.map((p, idx) => (
                <TouchableOpacity
                  key={idx}
                  onPress={() => toggleProductSelection(p.sku)}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eee' }}
                >
                  <MaterialCommunityIcons
                    name={selectedProducts.includes(p.sku) ? "checkbox-marked" : "checkbox-blank-outline"}
                    size={24}
                    color={selectedProducts.includes(p.sku) ? "#F36F21" : "#666"}
                  />
                  <View style={{ marginLeft: 10 }}>
                    <Text style={{ fontWeight: 'bold' }}>{p.name}</Text>
                    <Text variant="bodySmall">{p.sku}</Text>
                  </View>
                </TouchableOpacity>
              ))}
              {availableProducts.length === 0 && <Text>No hay productos en esta bodega.</Text>}
            </ScrollView>
            <Button mode="contained" onPress={() => setShowProductSelector(false)} buttonColor="#F36F21" style={{ marginTop: 10 }}>Confirmar Selección</Button>
          </Modal>
        </Portal>
      </Modal>
    </Portal>
  );
};

// --- STOCK LIST ---
function StockList() {
  const navigation = useNavigation();
  const [products, setProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Todas');
  const CATEGORIES = ["Todas", "Insumos", "Grasas", "Repostería", "Lácteos", "Otros"];
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [wasteModalVisible, setWasteModalVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  useEffect(() => {
    const u = onSnapshot(query(collection(db, "products"), orderBy("createdAt", "desc")), (s) => setProducts(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => u();
  }, []);

  const openEdit = (p) => { setSelectedProduct(p); setEditModalVisible(true); };
  const openWaste = (p) => { setSelectedProduct(p); setWasteModalVisible(true); };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name?.toLowerCase().includes(searchQuery.toLowerCase()) || p.sku?.includes(searchQuery);
    const matchesCategory = categoryFilter === 'Todas' || p.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <View style={{ flex: 1 }}>
      <View style={{ padding: 10, backgroundColor: 'white' }}>
        <Searchbar placeholder="Buscar por nombre o SKU..." onChangeText={setSearchQuery} value={searchQuery} style={{ backgroundColor: '#f0f0f0', marginBottom: 10, borderRadius: 10 }} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 5 }}>
          {CATEGORIES.map(cat => (
            <Chip key={cat} selected={categoryFilter === cat} onPress={() => setCategoryFilter(cat)} style={{ marginRight: 8, backgroundColor: categoryFilter === cat ? '#F36F21' : '#f0f0f0' }} textStyle={{ color: categoryFilter === cat ? 'white' : '#666' }}>{cat}</Chip>
          ))}
        </ScrollView>
      </View>
      <ScrollView style={styles.scroll}>
        {filteredProducts.map((p) => {
          const displayStock = p.stock !== undefined ? p.stock : p.quantity;
          const displayLoc = p.location || p.aisle || '-';
          return (
            <Card key={p.id} style={styles.card}>
              <Card.Content>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                  <Text style={{ fontWeight: 'bold', fontSize: 16, flex: 1 }}>{p.name}</Text>
                  <Chip compact style={{ backgroundColor: '#E0F7FA', height: 28 }} textStyle={{ fontSize: 10 }}>{p.category || 'General'}</Chip>
                </View>
                <Divider style={{ marginBottom: 10 }} />
                <View style={{ flexDirection: 'row', marginBottom: 5 }}>
                  <View style={{ flex: 1 }}><Text variant="labelSmall" style={{ color: '#666' }}>SKU</Text><Text variant="bodyMedium">{p.sku}</Text></View>
                  <View style={{ flex: 1 }}><Text variant="labelSmall" style={{ color: '#666' }}>Proveedor</Text><Text variant="bodyMedium">{p.provider || '-'}</Text></View>
                </View>
                <View style={{ flexDirection: 'row', marginBottom: 10 }}>
                  <View style={{ flex: 1 }}><Text variant="labelSmall" style={{ color: '#666' }}>Bodega</Text><Text variant="bodyMedium">{displayLoc}</Text></View>
                  <View style={{ flex: 1 }}><Text variant="labelSmall" style={{ color: '#666' }}>Mí­nimo</Text><Text variant="bodyMedium">{p.minStock || 10}</Text></View>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f9f9f9', padding: 8, borderRadius: 5 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text variant="bodyMedium" style={{ marginRight: 5 }}>Stock Total:</Text>
                    <Text variant="headlineSmall" style={{ fontWeight: 'bold', color: displayStock < (p.minStock || 10) ? 'red' : '#2E7D32' }}>{displayStock}</Text>
                  </View>
                  <View style={{ flexDirection: 'row' }}>
                    <IconButton icon="pencil" mode="contained" containerColor="#E0E0E0" iconColor="#333" size={20} onPress={() => openEdit(p)} />
                    <IconButton icon="trash-can-outline" mode="contained" containerColor="#FFEBEE" iconColor="#D32F2F" size={20} onPress={() => openWaste(p)} />
                  </View>
                </View>
              </Card.Content>
            </Card>
          );
        })}
        {filteredProducts.length === 0 && <Text style={{ textAlign: 'center', marginTop: 20, color: '#999' }}>No se encontraron productos.</Text>}
      </ScrollView>
      <FAB icon="plus" label="Nuevo" style={styles.fab} onPress={() => navigation.navigate('Escanear', { openManual: true })} color="white" />
      <EditProductModal visible={editModalVisible} hide={() => setEditModalVisible(false)} product={selectedProduct} />
      <ReportWasteModal visible={wasteModalVisible} hide={() => setWasteModalVisible(false)} product={selectedProduct} />
    </View>
  );
}

// --- HISTORIAL DE CONTEOS ---
function CountHistoryList() {
  const [counts, setCounts] = useState([]);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [selectedCount, setSelectedCount] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const STATUS_OPTIONS = ["Todos", "Pendiente", "Cerrado", "Discrepancia"];

  useEffect(() => {
    const q = query(collection(db, "counts"), orderBy("date", "desc"));
    const u = onSnapshot(q, (s) => setCounts(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => u();
  }, []);

  const handleViewDetail = (count) => { setSelectedCount(count); setDetailModalVisible(true); };

  const handleExport = async (count) => {
    Alert.alert("Exportar", "Simulando descarga de Excel...");
  };

  const handleDelete = (count) => {
    Alert.alert(
      "Eliminar Conteo",
      `¿Estás seguro de eliminar el conteo ${count.countId}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteDoc(doc(db, "counts", count.id));
              Alert.alert("Eliminado", "El conteo ha sido eliminado.");
            } catch (e) {
              Alert.alert("Error", e.message);
            }
          }
        }
      ]
    );
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Pendiente': return '#FFF3E0';
      case 'Cerrado': return '#E8F5E9';
      case 'Discrepancia': return '#FFEBEE';
      default: return '#f0f0f0';
    }
  };

  const getStatusTextColor = (status) => {
    switch (status) {
      case 'Pendiente': return '#EF6C00';
      case 'Cerrado': return '#2E7D32';
      case 'Discrepancia': return '#C62828';
      default: return '#666';
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '-';
    const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return d.toLocaleDateString();
  };

  const filteredCounts = counts.filter(c => {
    const matchesSearch = c.countId.toLowerCase().includes(searchQuery.toLowerCase()) || c.worker.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'Todos' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <View style={{ flex: 1 }}>
      <View style={{ padding: 10, backgroundColor: 'white' }}>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
          <View style={{ flex: 1 }}>
            <Searchbar placeholder="Buscar..." onChangeText={setSearchQuery} value={searchQuery} style={{ backgroundColor: '#f0f0f0', height: 45 }} inputStyle={{ minHeight: 0 }} />
          </View>
          <Menu
            visible={showStatusMenu}
            onDismiss={() => setShowStatusMenu(false)}
            anchor={
              <TouchableOpacity onPress={() => setShowStatusMenu(true)} style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#ccc', borderRadius: 25, paddingHorizontal: 15, height: 45, backgroundColor: 'white' }}>
                <Text style={{ marginRight: 5, color: '#555' }}>{statusFilter}</Text>
                <MaterialCommunityIcons name="chevron-down" size={20} color="#666" />
              </TouchableOpacity>
            }
          >
            {STATUS_OPTIONS.map(s => <Menu.Item key={s} onPress={() => { setStatusFilter(s); setShowStatusMenu(false); }} title={s} />)}
          </Menu>
        </View>
      </View>

      <ScrollView style={styles.scroll}>
        {filteredCounts.length === 0 && <Text style={{ textAlign: 'center', marginTop: 20 }}>No se encontraron conteos.</Text>}
        {filteredCounts.map((c) => (
          <Card key={c.id} style={[styles.card, { borderLeftWidth: 4, borderLeftColor: getStatusTextColor(c.status) }]}>
            <Card.Content>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <MaterialCommunityIcons name="clipboard-list" size={20} color="#555" style={{ marginRight: 5 }} />
                  <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>{c.countId}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <IconButton icon="trash-can-outline" size={20} iconColor="#D32F2F" onPress={() => handleDelete(c)} />
                </View>
              </View>
              <Divider style={{ marginBottom: 10 }} />
              <View style={{ marginBottom: 10 }}>
                <Text variant="bodySmall">Fecha: {formatDate(c.date)}</Text>
                <Text variant="bodySmall">Bodeguero: {c.worker}</Text>
                <Text variant="bodySmall">Bodega: {c.aisle}</Text>
              </View>
              <View style={{ backgroundColor: '#f9f9f9', padding: 10, borderRadius: 8, flexDirection: 'row', justifyContent: 'space-around' }}>
                <View style={{ alignItems: 'center' }}><Text variant="labelSmall">Esperado</Text><Text variant="titleMedium" style={{ fontWeight: 'bold' }}>{c.expected}</Text></View>
                <View style={{ width: 1, backgroundColor: '#ddd' }} />
                <View style={{ alignItems: 'center' }}><Text variant="labelSmall">Contado</Text><Text variant="titleMedium" style={{ fontWeight: 'bold' }}>{c.counted}</Text></View>
              </View>
            </Card.Content>
            <Card.Actions style={{ justifyContent: 'flex-end', paddingTop: 0 }}>
              <Button mode="text" compact icon="eye" textColor="#666" onPress={() => handleViewDetail(c)}>Ver Detalle</Button>
              <Button mode="text" compact icon="file-excel" textColor="#2E7D32" onPress={() => handleExport(c)}>Exportar</Button>
            </Card.Actions>
          </Card>
        ))}
      </ScrollView>
      <FAB icon="plus" label="Nuevo Conteo" style={styles.fab} onPress={() => setCreateModalVisible(true)} color="white" />
      <CountDetailModal visible={detailModalVisible} hide={() => setDetailModalVisible(false)} count={selectedCount} />
      <CreateCountModal visible={createModalVisible} hide={() => setCreateModalVisible(false)} />
    </View>
  );
}

// --- KARDEX ---
function KardexList() {
  const [movements, setMovements] = useState([]);
  const [search, setSearch] = useState('');
  useEffect(() => {
    const u = onSnapshot(query(collection(db, "kardex"), orderBy("date", "desc")), (s) => setMovements(s.docs.map(d => ({ id: d.id, ...d.data(), formattedDate: d.data().date?.toDate().toLocaleDateString() }))));
    return () => u();
  }, []);
  const filtered = movements.filter(m => m.productName?.toLowerCase().includes(search.toLowerCase()));
  return (
    <View style={{ flex: 1 }}>
      <View style={{ padding: 10, backgroundColor: 'white' }}><Searchbar placeholder="Buscar..." onChangeText={setSearch} value={search} style={{ backgroundColor: '#f0f0f0' }} /></View>
      <ScrollView style={styles.scroll}>
        {filtered.map(m => (
          <View key={m.id} style={[styles.card, { padding: 15, flexDirection: 'row', alignItems: 'center' }]}>
            <MaterialCommunityIcons name={m.type === 'Entrada' ? "arrow-up-bold-circle" : "arrow-down-bold-circle"} color={m.type === 'Entrada' ? "green" : "red"} size={30} />
            <View style={{ marginLeft: 15, flex: 1 }}>
              <Text style={{ fontWeight: 'bold' }}>{m.productName}</Text>
              <Text variant="bodySmall">{m.sku}</Text>
              <Text variant="bodySmall" style={{ color: '#666', fontSize: 10 }}>{m.reason || m.type} â€¢ {m.formattedDate}</Text>
            </View>
            <Text variant="titleMedium" style={{ fontWeight: 'bold', color: m.type === 'Entrada' ? 'green' : '#D32F2F' }}>{m.type === 'Entrada' ? '+' : '-'}{m.quantity}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const TopTab = createMaterialTopTabNavigator();
function InventoryTabs() {
  return (
    <TopTab.Navigator screenOptions={{ tabBarLabelStyle: { fontSize: 12, fontWeight: 'bold' }, tabBarIndicatorStyle: { backgroundColor: '#F36F21' } }}>
      <TopTab.Screen name="Stock" component={StockList} />
      <TopTab.Screen name="Conteos" component={CountHistoryList} />
      <TopTab.Screen name="Kardex" component={KardexList} />
    </TopTab.Navigator>
  );
}

export default function InventoryScreen() {
  const navigation = useNavigation();
  return (
    <View style={{ flex: 1 }}>
      <View style={styles.header}>
        <IconButton icon="menu" iconColor="white" size={30} onPress={() => navigation.openDrawer()} />
        <Text variant="titleLarge" style={{ color: 'white', fontWeight: 'bold', marginLeft: 10 }}>Inventario</Text>
      </View>
      <InventoryTabs />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: '#F36F21', paddingTop: 40, paddingBottom: 10, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', elevation: 4 },
  scroll: { flex: 1, padding: 10, backgroundColor: '#f0f0f0' },
  card: { marginBottom: 12, backgroundColor: 'white' },
  modal: { backgroundColor: 'white', padding: 20, margin: 20, borderRadius: 10 },
  input: { marginBottom: 10, backgroundColor: 'white' },
  label: { marginBottom: 5, fontWeight: 'bold', color: '#555' },
  fab: { position: 'absolute', margin: 16, right: 0, bottom: 0, backgroundColor: '#607D8B' }
});
