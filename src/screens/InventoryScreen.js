import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { Card, Text, Chip, IconButton, Portal, Modal, TextInput, Button, Searchbar, RadioButton, FAB, Menu, Divider, List } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { useNavigation } from '@react-navigation/native';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, addDoc, deleteDoc, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebaseConfig';

// --- COMPONENTE REUTILIZABLE: SELECTION MODAL ---
const SelectionModal = ({ visible, hide, title, items, onSelect, renderItem }) => {
  return (
    <Portal>
      <Modal visible={visible} onDismiss={hide} contentContainerStyle={styles.modal}>
        <Text variant="titleMedium" style={{ marginBottom: 15, textAlign: 'center', fontWeight: 'bold', color: '#F36F21' }}>{title}</Text>
        <ScrollView style={{ maxHeight: 300 }}>
          {items.length === 0 ? (
            <Text style={{ textAlign: 'center', color: '#666', padding: 20 }}>No hay opciones disponibles.</Text>
          ) : (
            items.map((item, index) => (
              <React.Fragment key={index}>
                {renderItem ? (
                  renderItem(item, () => { onSelect(item); hide(); })
                ) : (
                  <List.Item
                    title={item}
                    onPress={() => { onSelect(item); hide(); }}
                    left={props => <List.Icon {...props} icon="chevron-right" color="#F36F21" />}
                  />
                )}
                <Divider />
              </React.Fragment>
            ))
          )}
        </ScrollView>
        <Button mode="text" onPress={hide} style={{ marginTop: 10 }}>Cerrar</Button>
      </Modal>
    </Portal>
  );
};

// --- MODAL 1: EDITAR PRODUCTO ---
// --- MODAL 1: EDITAR PRODUCTO ---
const EditProductModal = ({ visible, hide, product, providers }) => {
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [provider, setProvider] = useState('');
  const [location, setLocation] = useState('');
  const [showLocPicker, setShowLocPicker] = useState(false);
  const WAREHOUSES = ["Bodega 1", "Bodega 2", "Bodega 3", "Bodega 4", "Bodega 5", "Cámara de Frío"];

  const [stock, setStock] = useState('');
  const [minStock, setMinStock] = useState('');
  const [unitType, setUnitType] = useState('Unidad');
  const [numBoxes, setNumBoxes] = useState('');
  const [unitsPerBox, setUnitsPerBox] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCatMenu, setShowCatMenu] = useState(false);
  const CATEGORIES = ["Insumos", "Grasas", "Repostería", "Lácteos", "Harinas", "Otros"];

  const [showProviderMenu, setShowProviderMenu] = useState(false);

  useEffect(() => {
    if (product) {
      setSku(product.sku || '');
      setName(product.name || '');
      setCategory(product.category || '');
      setProvider(product.provider || '');
      setLocation(product.location || product.aisle || '');
      setStock(String(product.stock || product.quantity || ''));
      setMinStock(String(product.minStock || '10'));
      setUnitType(product.unitType || 'Unidad');
      setNumBoxes(String(product.numBoxes || ''));
      setUnitsPerBox(String(product.unitsPerBox || ''));
    }
  }, [product]);

  const handleUpdate = async () => {
    setLoading(true);

    let finalStock = 0;
    if (unitType === 'Unidad') {
      finalStock = parseInt(stock) || 0;
    } else {
      finalStock = (parseInt(numBoxes) || 0) * (parseInt(unitsPerBox) || 0);
    }

    try {
      const productRef = doc(db, "products", product.id);
      await updateDoc(productRef, {
        sku, name, category, provider,
        location, aisle: location,
        unitType,
        stock: finalStock,
        quantity: finalStock,
        minStock: parseInt(minStock) || 0,
        numBoxes: unitType === 'Caja' ? (parseInt(numBoxes) || 0) : 0,
        unitsPerBox: unitType === 'Caja' ? (parseInt(unitsPerBox) || 0) : 0,
        updatedAt: new Date()
      });
      hide();
      Alert.alert("Éxito", "Producto actualizado.");
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
            <Text style={styles.label}>Categoría</Text>
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
            <TouchableOpacity onPress={() => setShowProviderMenu(true)}>
              <TextInput value={provider} mode="outlined" editable={false} right={<TextInput.Icon icon="chevron-down" />} style={styles.input} dense />
            </TouchableOpacity>
            <SelectionModal
              visible={showProviderMenu}
              hide={() => setShowProviderMenu(false)}
              title="Seleccionar Proveedor"
              items={providers || []}
              onSelect={setProvider}
            />
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

        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10, marginTop: 5 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 20 }}>
            <RadioButton value="Unidad" status={unitType === 'Unidad' ? 'checked' : 'unchecked'} onPress={() => setUnitType('Unidad')} color="#F36F21" />
            <Text onPress={() => setUnitType('Unidad')}>Unidad</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <RadioButton value="Caja" status={unitType === 'Caja' ? 'checked' : 'unchecked'} onPress={() => setUnitType('Caja')} color="#F36F21" />
            <Text onPress={() => setUnitType('Caja')}>Caja</Text>
          </View>
        </View>

        {unitType === 'Unidad' ? (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Stock Actual</Text>
              <TextInput value={stock} onChangeText={setStock} keyboardType="numeric" mode="outlined" style={styles.input} dense />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Mínimo</Text>
              <TextInput value={minStock} onChangeText={setMinStock} keyboardType="numeric" mode="outlined" style={styles.input} dense />
            </View>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>N° Cajas</Text>
              <TextInput value={numBoxes} onChangeText={setNumBoxes} keyboardType="numeric" mode="outlined" placeholder="0" style={styles.input} dense />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Unid/Caja</Text>
              <TextInput value={unitsPerBox} onChangeText={setUnitsPerBox} keyboardType="numeric" mode="outlined" placeholder="0" style={styles.input} dense />
            </View>
          </View>
        )}

        {unitType === 'Caja' && (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Mínimo</Text>
              <TextInput value={minStock} onChangeText={setMinStock} keyboardType="numeric" mode="outlined" style={styles.input} dense />
            </View>
          </View>
        )}

        <Button mode="contained" onPress={handleUpdate} loading={loading} buttonColor="#F36F21" style={{ marginTop: 20 }}>Actualizar</Button>
      </Modal>
    </Portal>
  );
};

// --- MODAL 2: REPORTAR MERMA ---
const ReportWasteModal = ({ visible, hide, product, products }) => {
  const [qty, setQty] = useState('');
  const [cause, setCause] = useState('Vencido');
  const [loading, setLoading] = useState(false);

  // Nuevos campos
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [batch, setBatch] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [showCauseMenu, setShowCauseMenu] = useState(false);

  const CAUSES = ["Vencido", "Daño", "Robo", "Consumo Interno", "Otro"];

  useEffect(() => {
    if (product) {
      setSelectedProduct(product);
      setSearchQuery(product.name || '');
    } else {
      setSelectedProduct(null);
      setSearchQuery('');
    }
    setQty('');
    setBatch('');
    setUnitCost('');
    setCause('Vencido');
  }, [product, visible]);

  const handleSelectProduct = (p) => {
    setSelectedProduct(p);
    setSearchQuery(p.name);
    setShowSuggestions(false);
  };

  const handleConfirmWaste = async () => {
    if (!selectedProduct) return Alert.alert("Error", "Selecciona un producto.");
    if (!qty) return Alert.alert("Error", "Ingresa la cantidad.");

    setLoading(true);
    try {
      const deduction = parseInt(qty);
      const currentStock = selectedProduct.stock || selectedProduct.quantity || 0;

      if (currentStock < deduction) {
        setLoading(false);
        return Alert.alert("Error", "Stock insuficiente.");
      }

      const newStock = currentStock - deduction;

      // Actualizar producto
      await updateDoc(doc(db, "products", selectedProduct.id), { stock: newStock, quantity: newStock });

      // Registrar en Waste
      await addDoc(collection(db, "waste"), {
        sku: selectedProduct.sku,
        productName: selectedProduct.name,
        quantity: deduction,
        cause,
        batch,
        unitCost: parseFloat(unitCost) || 0,
        date: new Date()
      });

      // Registrar en Kardex
      await addDoc(collection(db, "kardex"), {
        sku: selectedProduct.sku,
        productName: selectedProduct.name,
        type: "Salida",
        quantity: deduction,
        reason: `Merma (${cause})`,
        date: new Date(),
        user: "Bodeguero"
      });

      // Check for Low Stock
      const minStock = selectedProduct.minStock || 10;
      if (newStock <= minStock) {
        await addDoc(collection(db, "general_alerts"), {
          title: 'Quiebre de Stock',
          desc: `El producto ${selectedProduct.name} ha alcanzado el nivel crítico. Stock actual: ${newStock}.`,
          type: 'Stock',
          color: '#D32F2F',
          icon: 'alert-octagon',
          date: new Date().toISOString().split('T')[0],
          isSystem: true
        });
      }

      Alert.alert("Listo", `Descontadas ${deduction} un.`);
      hide();
    } catch (e) { Alert.alert("Error", e.message); } finally { setLoading(false); }
  };

  const filteredProducts = products ? products.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.sku.includes(searchQuery)) : [];

  return (
    <Portal>
      <Modal visible={visible} onDismiss={hide} contentContainerStyle={styles.modal}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
          <Text variant="headlineSmall" style={{ fontWeight: 'bold', color: '#333' }}>Registrar Nueva Merma</Text>
          <IconButton icon="close" size={24} onPress={hide} />
        </View>

        <Text style={styles.label}>Producto (Nombre o SKU)</Text>
        <View>
          <TextInput
            placeholder="Buscar por SKU o Nombre..."
            value={searchQuery}
            onChangeText={(t) => { setSearchQuery(t); setShowSuggestions(true); }}
            mode="outlined"
            style={styles.input}
            dense
            right={<TextInput.Icon icon="magnify" />}
          />
          {showSuggestions && searchQuery.length > 0 && (
            <View style={{ maxHeight: 150, backgroundColor: '#f9f9f9', borderWidth: 1, borderColor: '#eee', borderRadius: 5 }}>
              <ScrollView nestedScrollEnabled>
                {filteredProducts.map(p => (
                  <TouchableOpacity key={p.id} onPress={() => handleSelectProduct(p)} style={{ padding: 10, borderBottomWidth: 1, borderBottomColor: '#eee' }}>
                    <Text style={{ fontWeight: 'bold' }}>{p.name}</Text>
                    <Text variant="bodySmall">{p.sku}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Lote</Text>
            <TextInput value={batch} onChangeText={setBatch} mode="outlined" placeholder="L-2023-X" style={styles.input} dense />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Cantidad</Text>
            <TextInput value={qty} onChangeText={setQty} keyboardType="numeric" mode="outlined" placeholder="0" style={styles.input} dense />
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Causa</Text>
            <Menu
              visible={showCauseMenu}
              onDismiss={() => setShowCauseMenu(false)}
              anchor={
                <TouchableOpacity onPress={() => setShowCauseMenu(true)}>
                  <TextInput value={cause} mode="outlined" editable={false} right={<TextInput.Icon icon="chevron-down" />} style={styles.input} dense />
                </TouchableOpacity>
              }
            >
              {CAUSES.map(c => <Menu.Item key={c} onPress={() => { setCause(c); setShowCauseMenu(false); }} title={c} />)}
            </Menu>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Costo Unitario</Text>
            <TextInput value={unitCost} onChangeText={setUnitCost} keyboardType="numeric" mode="outlined" placeholder="0" style={styles.input} dense />
          </View>
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
          <Button mode="outlined" onPress={hide} textColor="#666" style={{ borderColor: '#ccc' }}>Cancelar</Button>
          <Button mode="contained" onPress={handleConfirmWaste} loading={loading} buttonColor="#D32F2F">Registrar Pérdida</Button>
        </View>
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

  // Box Option State
  const [countFormat, setCountFormat] = useState('Unidad');
  const [boxCount, setBoxCount] = useState('');
  const [unitsPerBox, setUnitsPerBox] = useState('');

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
    setCountFormat('Unidad');
    setBoxCount('');
    setUnitsPerBox('');
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
    let val = 0;
    if (countFormat === 'Unidad') {
      val = parseInt(countedQty);
    } else {
      val = (parseInt(boxCount) || 0) * (parseInt(unitsPerBox) || 0);
    }

    if (isNaN(val)) return Alert.alert("Error", "Ingresa un número válido");

    // Si es caja, actualizamos countedQty con el total calculado para que se guarde correctamente
    setCountedQty(String(val));
    setStep('RESULT');
  };

  const handleSaveAndNext = async () => {
    // DEBUG: Check values
    Alert.alert("Debug Start", `Fmt: ${countFormat}, Qty: ${countedQty}, Box: ${boxCount}, Exp: ${currentItem?.expected}`);

    let val = 0;
    if (countFormat === 'Unidad') {
      val = parseInt(countedQty);
    } else {
      val = (parseInt(boxCount) || 0) * (parseInt(unitsPerBox) || 0);
    }

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

      // Trigger Alert if Discrepancy
      const currentVal = isNaN(val) ? 0 : val;
      const diff = currentVal - (currentItem.expected || 0);

      // DEBUG: Diagnose why alert is not appearing
      if (diff !== 0) {
        Alert.alert("Debug", `Detectada diferencia: ${diff}. Guardando alerta...`);
      } else {
        // Alert.alert("Debug", "No hay diferencia (Diff = 0)");
      }

      if (diff !== 0) {
        await addDoc(collection(db, "general_alerts"), {
          title: `Discrepancia en ${currentItem.name}`,
          desc: `El conteo físico no coincide con el sistema.`,
          type: 'Discrepancia',
          color: '#4527A0',
          icon: 'file-document-outline',
          date: new Date(),
          expected: parseInt(currentItem.expected) || 0,
          counted: parseInt(currentVal) || 0,
          isSystem: true
        });
      }

      setItems(updatedItems);
      // Return to SUMMARY instead of SCAN loop, as per user preference for list selection
      setStep('SUMMARY');
      setCurrentItem(null);
      setCountedQty('');
      setBoxCount('');
      setUnitsPerBox('');
      setCountFormat('Unidad');

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
              <Text variant="bodyMedium" style={{ color: '#666' }}>{count.worker} • {count.aisle}</Text>
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

          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 20 }}>
              <RadioButton value="Unidad" status={countFormat === 'Unidad' ? 'checked' : 'unchecked'} onPress={() => setCountFormat('Unidad')} color="#F36F21" />
              <Text onPress={() => setCountFormat('Unidad')}>Unidad</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <RadioButton value="Caja" status={countFormat === 'Caja' ? 'checked' : 'unchecked'} onPress={() => setCountFormat('Caja')} color="#F36F21" />
              <Text onPress={() => setCountFormat('Caja')}>Caja</Text>
            </View>
          </View>

          {countFormat === 'Unidad' ? (
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
          ) : (
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
              <TextInput
                label="N° Cajas"
                value={boxCount}
                onChangeText={setBoxCount}
                keyboardType="numeric"
                mode="outlined"
                style={{ flex: 1, backgroundColor: 'white' }}
              />
              <TextInput
                label="Unid/Caja"
                value={unitsPerBox}
                onChangeText={setUnitsPerBox}
                keyboardType="numeric"
                mode="outlined"
                style={{ flex: 1, backgroundColor: 'white' }}
              />
            </View>
          )}

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
        items: itemsSnapshot,
        origin: 'Móvil'
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

          <Button mode="contained" onPress={async () => {
            // Check for discrepancy and alert
            const diff = resultData.counted - resultData.expected;
            if (diff !== 0) {
              await addDoc(collection(db, "general_alerts"), {
                title: `Discrepancia en Conteo ${resultData.countId}`,
                desc: `El conteo físico no coincide con el sistema.`,
                type: 'Discrepancia',
                color: '#4527A0',
                icon: 'file-document-outline',
                date: new Date(),
                expected: parseInt(resultData.expected) || 0,
                counted: parseInt(resultData.counted) || 0,
                isSystem: true
              });
            }
            resetForm();
          }} buttonColor="#F36F21" contentStyle={{ height: 50 }} style={{ marginBottom: 10 }}>
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

// --- MODAL 6: ESCÁNER SIMPLE ---
const SimpleScannerModal = ({ visible, hide, onScan }) => {
  const [permission, requestPermission] = useCameraPermissions();

  useEffect(() => {
    if (visible && !permission?.granted) requestPermission();
  }, [visible]);

  if (!visible) return null;

  return (
    <Portal>
      <Modal visible={visible} onDismiss={hide} contentContainerStyle={[styles.modal, { padding: 0, height: '100%', width: '100%', margin: 0 }]}>
        <View style={{ flex: 1, backgroundColor: 'black' }}>
          <CameraView
            style={{ flex: 1 }}
            facing="back"
            onBarcodeScanned={({ data }) => { onScan(data); hide(); }}
          />
          <View style={{ position: 'absolute', top: 50, left: 20 }}>
            <IconButton icon="close" iconColor="white" size={30} onPress={hide} />
          </View>
          <View style={{ position: 'absolute', bottom: 50, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.6)', padding: 10, borderRadius: 5 }}>
            <Text style={{ color: 'white', fontWeight: 'bold' }}>Escanea el código de barras</Text>
          </View>
        </View>
      </Modal>
    </Portal>
  );
};

// --- MODAL 5: AGREGAR PRODUCTO ---
const AddProductModal = ({ visible, hide, providers }) => {
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [provider, setProvider] = useState('');
  const [location, setLocation] = useState('');
  const [stock, setStock] = useState('');
  const [minStock, setMinStock] = useState('');
  const [unitType, setUnitType] = useState('Unidad');
  const [numBoxes, setNumBoxes] = useState(''); // Nuevo estado
  const [unitsPerBox, setUnitsPerBox] = useState(''); // Nuevo estado
  const [loading, setLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  const [showCatMenu, setShowCatMenu] = useState(false);
  const [showLocMenu, setShowLocMenu] = useState(false);
  const [showProviderMenu, setShowProviderMenu] = useState(false);

  const CATEGORIES = ["Insumos", "Grasas", "Repostería", "Lácteos", "Harinas", "Otros"];
  const WAREHOUSES = ["Bodega 1", "Bodega 2", "Bodega 3", "Bodega 4", "Bodega 5", "Cámara de Frío"];

  const [expiryDate, setExpiryDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  const handleSave = async () => {
    if (!sku || !name || !category || !location) {
      return Alert.alert("Error", "Completa los campos obligatorios (SKU, Nombre, Categoría, Bodega)");
    }

    let finalStock = 0;
    if (unitType === 'Unidad') {
      finalStock = parseInt(stock) || 0;
    } else {
      finalStock = (parseInt(numBoxes) || 0) * (parseInt(unitsPerBox) || 0);
    }

    setLoading(true);
    try {
      const q = query(collection(db, "products"), where("sku", "==", sku));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        setLoading(false);
        return Alert.alert("Error", "El SKU ya existe.");
      }

      await addDoc(collection(db, "products"), {
        sku, name, category, provider,
        location, aisle: location,
        unitType,
        stock: finalStock,
        quantity: finalStock,
        minStock: parseInt(minStock) || 0,
        // Guardamos detalles adicionales si es caja
        numBoxes: unitType === 'Caja' ? (parseInt(numBoxes) || 0) : 0,
        unitsPerBox: unitType === 'Caja' ? (parseInt(unitsPerBox) || 0) : 0,
        expiryDate: expiryDate, // Save Date object or Timestamp
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // GENERATE PERSISTENT ALERTS
      const today = new Date();
      // 1. Stock
      if (finalStock <= (parseInt(minStock) || 10)) {
        await addDoc(collection(db, "general_alerts"), {
          title: 'Stock Crítico',
          desc: `Quedan solo ${finalStock} unidades de ${name}.`,
          type: 'Stock',
          color: '#FBC02D',
          icon: 'package-variant',
          date: new Date(),
          isSystem: true
        });
      }
      // 2. Expiry
      const diffDays = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
      if (diffDays < 0) {
        await addDoc(collection(db, "general_alerts"), {
          title: 'Producto Vencido',
          desc: `${name} venció hace ${Math.abs(diffDays)} días.`,
          type: 'FEFO',
          color: '#D32F2F',
          icon: 'calendar-clock',
          date: new Date(),
          isSystem: true
        });
      } else if (diffDays <= 7) {
        await addDoc(collection(db, "general_alerts"), {
          title: 'Riesgo Vencimiento',
          desc: `${name} vence en ${diffDays} días.`,
          type: 'FEFO',
          color: '#F57C00',
          icon: 'calendar-clock',
          date: new Date(),
          isSystem: true
        });
      }

      Alert.alert("Éxito", "Producto agregado correctamente.");
      setSku(''); setName(''); setCategory(''); setProvider(''); setLocation('');
      setStock(''); setMinStock(''); setUnitType('Unidad'); setNumBoxes(''); setUnitsPerBox('');
      setExpiryDate(new Date());
      hide();
    } catch (e) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Portal>
      <Modal visible={visible} onDismiss={hide} contentContainerStyle={styles.modal}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
          <Text variant="headlineSmall" style={{ fontWeight: 'bold', color: '#333' }}>Nuevo Producto</Text>
          <IconButton icon="close" size={24} onPress={hide} />
        </View>

        <ScrollView>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>SKU</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TextInput value={sku} onChangeText={setSku} mode="outlined" placeholder="Ej: PAN-001" style={[styles.input, { flex: 1 }]} dense />
                <IconButton icon="barcode-scan" iconColor="#F36F21" size={28} onPress={() => setShowScanner(true)} />
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Categoría</Text>
              <TouchableOpacity onPress={() => setShowCatMenu(true)}>
                <TextInput value={category} mode="outlined" placeholder="Seleccionar" editable={false} right={<TextInput.Icon icon="chevron-down" />} style={styles.input} dense />
              </TouchableOpacity>
              <SelectionModal
                visible={showCatMenu}
                hide={() => setShowCatMenu(false)}
                title="Seleccionar Categoría"
                items={CATEGORIES}
                onSelect={setCategory}
              />
            </View>
          </View>

          <Text style={styles.label}>Nombre del Producto</Text>
          <TextInput value={name} onChangeText={setName} mode="outlined" placeholder="Ej: Harina Selecta 25kg" style={styles.input} dense />

          <Text style={styles.label}>Proveedor</Text>
          <TouchableOpacity onPress={() => setShowProviderMenu(true)}>
            <TextInput value={provider} mode="outlined" placeholder="Seleccionar" editable={false} right={<TextInput.Icon icon="chevron-down" />} style={styles.input} dense />
          </TouchableOpacity>
          <SelectionModal
            visible={showProviderMenu}
            hide={() => setShowProviderMenu(false)}
            title="Seleccionar Proveedor"
            items={providers || []}
            onSelect={setProvider}
          />

          <Text style={styles.label}>Bodega</Text>
          <TouchableOpacity onPress={() => setShowLocMenu(true)}>
            <TextInput value={location} mode="outlined" placeholder="Seleccionar" editable={false} right={<TextInput.Icon icon="chevron-down" />} style={styles.input} dense />
          </TouchableOpacity>
          <SelectionModal
            visible={showLocMenu}
            hide={() => setShowLocMenu(false)}
            title="Seleccionar Bodega"
            items={WAREHOUSES}
            onSelect={setLocation}
          />

          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10, marginTop: 5 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 20 }}>
              <RadioButton value="Unidad" status={unitType === 'Unidad' ? 'checked' : 'unchecked'} onPress={() => setUnitType('Unidad')} color="#F36F21" />
              <Text onPress={() => setUnitType('Unidad')}>Unidad</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <RadioButton value="Caja" status={unitType === 'Caja' ? 'checked' : 'unchecked'} onPress={() => setUnitType('Caja')} color="#F36F21" />
              <Text onPress={() => setUnitType('Caja')}>Caja</Text>
            </View>
          </View>

          {unitType === 'Unidad' ? (
            <>
              <Text style={styles.label}>Cantidad</Text>
              <TextInput value={stock} onChangeText={setStock} keyboardType="numeric" mode="outlined" placeholder="0" style={styles.input} dense />
            </>
          ) : (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>N° Cajas</Text>
                <TextInput value={numBoxes} onChangeText={setNumBoxes} keyboardType="numeric" mode="outlined" placeholder="0" style={styles.input} dense />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Unid/Caja</Text>
                <TextInput value={unitsPerBox} onChangeText={setUnitsPerBox} keyboardType="numeric" mode="outlined" placeholder="0" style={styles.input} dense />
              </View>
            </View>
          )}

          <TouchableOpacity onPress={() => setShowDatePicker(true)} style={{ marginTop: 10, marginBottom: 10 }}>
            <TextInput
              label="Fecha Vencimiento"
              value={expiryDate.toLocaleDateString()}
              editable={false}
              mode="outlined"
              right={<TextInput.Icon icon="calendar" />}
              style={styles.input}
              dense
            />
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={expiryDate}
              mode="date"
              display="default"
              onChange={(event, selectedDate) => {
                setShowDatePicker(false);
                if (selectedDate) setExpiryDate(selectedDate);
              }}
            />
          )}

          <Text style={styles.label}>Stock Mínimo</Text>
          <TextInput value={minStock} onChangeText={setMinStock} keyboardType="numeric" mode="outlined" placeholder="0" style={styles.input} dense />

          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <Button mode="outlined" onPress={hide} textColor="#666" style={{ borderColor: '#ccc' }}>Cancelar</Button>
            <Button mode="contained" onPress={handleSave} loading={loading} buttonColor="#F36F21">Guardar Producto</Button>
          </View>
        </ScrollView>
      </Modal>
      <SimpleScannerModal visible={showScanner} hide={() => setShowScanner(false)} onScan={setSku} />
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
  const [addProductModalVisible, setAddProductModalVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  const [providers, setProviders] = useState([]);

  useEffect(() => {
    const u = onSnapshot(query(collection(db, "products"), orderBy("createdAt", "desc")), (s) => setProducts(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const u2 = onSnapshot(collection(db, "providers"), (s) => setProviders(s.docs.map(d => d.data().name)));
    return () => { u(); u2(); };
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
      <FAB icon="plus" label="Nuevo" style={styles.fab} onPress={() => setAddProductModalVisible(true)} color="white" />
      <EditProductModal visible={editModalVisible} hide={() => setEditModalVisible(false)} product={selectedProduct} providers={providers} />
      <ReportWasteModal visible={wasteModalVisible} hide={() => setWasteModalVisible(false)} product={selectedProduct} products={products} />
      <AddProductModal visible={addProductModalVisible} hide={() => setAddProductModalVisible(false)} providers={providers} />
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
          <TouchableOpacity onPress={() => setShowStatusMenu(true)} style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#ccc', borderRadius: 25, paddingHorizontal: 15, height: 45, backgroundColor: 'white' }}>
            <Text style={{ marginRight: 5, color: '#555' }}>{statusFilter}</Text>
            <MaterialCommunityIcons name="chevron-down" size={20} color="#666" />
          </TouchableOpacity>
          <SelectionModal
            visible={showStatusMenu}
            hide={() => setShowStatusMenu(false)}
            title="Filtrar por Estado"
            items={STATUS_OPTIONS}
            onSelect={setStatusFilter}
          />
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
                <Text variant="bodySmall">Origen: {c.origin || 'Web'}</Text>
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
              <Text variant="bodySmall" style={{ color: '#666', fontSize: 10 }}>{m.reason || m.type} • {m.formattedDate}</Text>
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

