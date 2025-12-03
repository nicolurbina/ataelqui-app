import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { Card, Text, Chip, IconButton, Portal, Modal, TextInput, Button, Searchbar, RadioButton, FAB, Menu, Divider } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { useNavigation } from '@react-navigation/native';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, addDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

// --- MODAL 1: EDITAR PRODUCTO (ACTUALIZADO) ---
const EditProductModal = ({ visible, hide, product }) => {
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [provider, setProvider] = useState('');
  const [aisle, setAisle] = useState('');
  const [stock, setStock] = useState('');
  const [minStock, setMinStock] = useState('');
  const [loading, setLoading] = useState(false);

  // Menús desplegables
  const [showCatMenu, setShowCatMenu] = useState(false);
  const [showAisleMenu, setShowAisleMenu] = useState(false);

  const CATEGORIES = ["Insumos", "Grasas", "Repostería", "Lácteos", "Otros"];
  const AISLES = [
    "Pasillo A - Granos",
    "Pasillo B - Enlatados",
    "Pasillo C - Limpieza",
    "Pasillo D - Bebidas",
    "Cámara de Frío 1",
    "Cámara de Frío 2",
    "Bodega Central"
  ];

  useEffect(() => {
    if (product) {
      setSku(product.sku || '');
      setName(product.name || '');
      setCategory(product.category || '');
      setProvider(product.provider || '');
      setAisle(product.aisle || '');
      setStock(product.stock ? String(product.stock) : '');
      setMinStock(product.minStock ? String(product.minStock) : '10'); // Valor por defecto
    }
  }, [product]);

  const handleUpdate = async () => {
    setLoading(true);
    try {
      const productRef = doc(db, "products", product.id);
      await updateDoc(productRef, {
        sku,
        name,
        category,
        provider,
        aisle,
        stock: parseInt(stock),
        minStock: parseInt(minStock)
      });
      hide();
      Alert.alert("Éxito", "Producto actualizado correctamente.");
    } catch (e) { Alert.alert("Error", e.message); } finally { setLoading(false); }
  };

  return (
    <Portal>
      <Modal visible={visible} onDismiss={hide} contentContainerStyle={styles.modal}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
          <Text variant="headlineSmall" style={{ fontWeight: 'bold', color: '#333' }}>Editar Producto</Text>
          <IconButton icon="close" size={24} onPress={hide} />
        </View>

        {/* FILA 1: SKU y CATEGORÍA */}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ marginBottom: 5, fontWeight: 'bold', color: '#555' }}>SKU</Text>
            <TextInput value={sku} onChangeText={setSku} mode="outlined" style={styles.input} dense />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ marginBottom: 5, fontWeight: 'bold', color: '#555' }}>Categoría</Text>
            <Menu
              visible={showCatMenu}
              onDismiss={() => setShowCatMenu(false)}
              anchor={
                <TouchableOpacity onPress={() => setShowCatMenu(true)}>
                  <TextInput
                    value={category}
                    mode="outlined"
                    editable={false}
                    right={<TextInput.Icon icon="chevron-down" />}
                    style={styles.input}
                    dense
                  />
                </TouchableOpacity>
              }
            >
              {CATEGORIES.map(cat => (
                <Menu.Item key={cat} onPress={() => { setCategory(cat); setShowCatMenu(false); }} title={cat} />
              ))}
            </Menu>
          </View>
        </View>

        {/* FILA 2: NOMBRE */}
        <Text style={{ marginBottom: 5, fontWeight: 'bold', color: '#555' }}>Nombre del Producto</Text>
        <TextInput value={name} onChangeText={setName} mode="outlined" style={styles.input} dense />

        {/* FILA 3: PROVEEDOR */}
        <Text style={{ marginBottom: 5, fontWeight: 'bold', color: '#555' }}>Proveedor</Text>
        <TextInput value={provider} onChangeText={setProvider} mode="outlined" style={styles.input} dense />

        {/* FILA 4: PASILLO */}
        <Text style={{ marginBottom: 5, fontWeight: 'bold', color: '#555' }}>Pasillo</Text>
        <Menu
          visible={showAisleMenu}
          onDismiss={() => setShowAisleMenu(false)}
          anchor={
            <TouchableOpacity onPress={() => setShowAisleMenu(true)}>
              <TextInput
                value={aisle}
                mode="outlined"
                editable={false}
                right={<TextInput.Icon icon="chevron-down" />}
                style={styles.input}
                dense
              />
            </TouchableOpacity>
          }
        >
          {AISLES.map(a => (
            <Menu.Item key={a} onPress={() => { setAisle(a); setShowAisleMenu(false); }} title={a} />
          ))}
        </Menu>

        {/* FILA 5: STOCK INICIAL y MÍNIMO */}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ marginBottom: 5, fontWeight: 'bold', color: '#555' }}>Stock Actual</Text>
            <TextInput value={stock} onChangeText={setStock} keyboardType="numeric" mode="outlined" style={styles.input} dense />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ marginBottom: 5, fontWeight: 'bold', color: '#555' }}>Stock Mínimo</Text>
            <TextInput value={minStock} onChangeText={setMinStock} keyboardType="numeric" mode="outlined" style={styles.input} dense />
          </View>
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
          <Button mode="outlined" onPress={hide} textColor="#666" style={{ borderColor: '#ccc' }}>Cancelar</Button>
          <Button mode="contained" onPress={handleUpdate} loading={loading} buttonColor="#F36F21">Actualizar Producto</Button>
        </View>
      </Modal>
    </Portal>
  );
};

// --- MODAL 2: REPORTAR MERMA RÁPIDA ---
const ReportWasteModal = ({ visible, hide, product }) => {
  const [qty, setQty] = useState('');
  const [cause, setCause] = useState('Vencido');
  const [loading, setLoading] = useState(false);

  const handleConfirmWaste = async () => {
    if (!qty) return Alert.alert("Error", "Ingresa la cantidad.");

    setLoading(true);
    try {
      const deduction = parseInt(qty);
      if (product.stock < deduction) {
        setLoading(false);
        return Alert.alert("Error", "No tienes suficiente stock para dar de baja.");
      }

      // 1. DESCONTAR STOCK
      await updateDoc(doc(db, "products", product.id), { stock: product.stock - deduction });

      // 2. REGISTRAR MERMA
      await addDoc(collection(db, "waste"), {
        sku: product.sku, productName: product.name, quantity: deduction, cause, date: new Date()
      });

      // 3. REGISTRAR KARDEX
      await addDoc(collection(db, "kardex"), {
        sku: product.sku, productName: product.name, type: "Salida", quantity: deduction,
        reason: `Merma Rápida (${cause})`, date: new Date(), user: "Bodeguero"
      });

      Alert.alert("Baja Exitosa", `Se descontaron ${deduction} unidades.`);
      setQty('');
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
        <Text variant="headlineSmall" style={{ marginBottom: 10, color: '#D32F2F', fontWeight: 'bold' }}>Registrar Merma</Text>
        <Text style={{ marginBottom: 15 }}>Producto: {product?.name}</Text>

        <TextInput label="Cantidad a eliminar" value={qty} onChangeText={setQty} keyboardType="numeric" mode="outlined" style={styles.input} autoFocus />

        <Text style={{ marginTop: 5 }}>Causa:</Text>
        <RadioButton.Group onValueChange={setCause} value={cause}>
          <View style={{ flexDirection: 'row', marginBottom: 15 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 15 }}><RadioButton value="Vencido" /><Text>Vencido</Text></View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}><RadioButton value="Daño" /><Text>Daño</Text></View>
          </View>
        </RadioButton.Group>

        <Button mode="contained" onPress={handleConfirmWaste} loading={loading} buttonColor="#D32F2F">Confirmar Baja</Button>
        <Button mode="text" onPress={hide} style={{ marginTop: 5 }}>Cancelar</Button>
      </Modal>
    </Portal>
  );
};

// --- MODAL 3: DETALLE DE CONTEO ---
const CountDetailModal = ({ visible, hide, count }) => {
  if (!count) return null;

  return (
    <Portal>
      <Modal visible={visible} onDismiss={hide} contentContainerStyle={[styles.modal, { maxHeight: '80%' }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
          <View>
            <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>Detalle de Conteo</Text>
            <Text variant="bodySmall" style={{ color: '#666' }}>{count.countId} • {count.worker}</Text>
          </View>
          <IconButton icon="close" size={24} onPress={hide} />
        </View>

        <ScrollView style={{ marginBottom: 15 }}>
          <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 5, marginBottom: 5 }}>
            <Text style={{ flex: 2, fontWeight: 'bold', fontSize: 12, color: '#666' }}>Producto</Text>
            <Text style={{ flex: 1, fontWeight: 'bold', fontSize: 12, color: '#666', textAlign: 'center' }}>Esp.</Text>
            <Text style={{ flex: 1, fontWeight: 'bold', fontSize: 12, color: '#666', textAlign: 'center' }}>Real</Text>
            <Text style={{ flex: 1, fontWeight: 'bold', fontSize: 12, color: '#666', textAlign: 'center' }}>Dif.</Text>
          </View>

          {count.items?.map((item, index) => {
            const diff = item.counted - item.expected;
            return (
              <View key={index} style={{ flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f5f5f5', alignItems: 'center' }}>
                <View style={{ flex: 2 }}>
                  <Text variant="bodyMedium" style={{ fontWeight: 'bold' }}>{item.name}</Text>
                  <Text variant="bodySmall" style={{ color: '#888' }}>{item.sku}</Text>
                </View>
                <Text style={{ flex: 1, textAlign: 'center' }}>{item.expected}</Text>
                <Text style={{ flex: 1, textAlign: 'center', fontWeight: 'bold', color: diff !== 0 ? '#D32F2F' : '#2E7D32' }}>{item.counted}</Text>
                <Text style={{ flex: 1, textAlign: 'center', color: diff !== 0 ? '#D32F2F' : '#ccc' }}>{diff !== 0 ? diff : '-'}</Text>
              </View>
            );
          })}
        </ScrollView>

        <Button mode="contained" onPress={hide} buttonColor="#F36F21">Cerrar</Button>
      </Modal>
    </Portal>
  );
};

// --- SUB-COMPONENTE: LISTA DE STOCK (ADAPTADA A CELULAR) ---
function StockList() {
  const navigation = useNavigation();
  const [products, setProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Filtros
  const [categoryFilter, setCategoryFilter] = useState('Todas');
  const CATEGORIES = ["Todas", "Insumos", "Grasas", "Repostería", "Lácteos", "Otros"];

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [wasteModalVisible, setWasteModalVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  useEffect(() => {
    const u = onSnapshot(query(collection(db, "products"), orderBy("createdAt", "desc")), (s) => setProducts(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => u();
  }, []);

  const openEdit = (product) => { setSelectedProduct(product); setEditModalVisible(true); };
  const openWaste = (product) => { setSelectedProduct(product); setWasteModalVisible(true); };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.sku.includes(searchQuery);
    const matchesCategory = categoryFilter === 'Todas' || p.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <View style={{ flex: 1 }}>
      <View style={{ padding: 10, backgroundColor: 'white' }}>

        {/* BUSCADOR */}
        <Searchbar
          placeholder="Buscar por nombre o SKU..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={{ backgroundColor: '#f0f0f0', marginBottom: 10, elevation: 0, borderRadius: 10 }}
          inputStyle={{ minHeight: 0 }}
        />

        {/* CHIPS DE CATEGORÍAS */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 5 }}>
          {CATEGORIES.map(cat => (
            <Chip
              key={cat}
              selected={categoryFilter === cat}
              onPress={() => setCategoryFilter(cat)}
              style={{ marginRight: 8, backgroundColor: categoryFilter === cat ? '#F36F21' : '#f0f0f0' }}
              textStyle={{ color: categoryFilter === cat ? 'white' : '#666', fontWeight: 'bold' }}
              showSelectedOverlay={true}
            >
              {cat}
            </Chip>
          ))}
        </ScrollView>
      </View>

      <ScrollView style={styles.scroll}>
        {filteredProducts.map((p) => (
          <Card key={p.id} style={styles.card}>
            <Card.Content>
              {/* HEADER: NOMBRE Y CATEGORÍA */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 5 }}>
                <Text style={{ fontWeight: 'bold', fontSize: 16, flex: 1, marginRight: 10 }}>{p.name}</Text>
                <Chip compact style={{ backgroundColor: '#E0F7FA', height: 28 }} textStyle={{ fontSize: 10 }}>{p.category || 'General'}</Chip>
              </View>

              <Divider style={{ marginBottom: 10 }} />

              {/* DETALLES EN GRILLA */}
              <View style={{ flexDirection: 'row', marginBottom: 5 }}>
                <View style={{ flex: 1 }}>
                  <Text variant="labelSmall" style={{ color: '#666' }}>SKU</Text>
                  <Text variant="bodyMedium">{p.sku}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="labelSmall" style={{ color: '#666' }}>Proveedor</Text>
                  <Text variant="bodyMedium" numberOfLines={1}>{p.provider || '-'}</Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', marginBottom: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text variant="labelSmall" style={{ color: '#666' }}>Pasillo</Text>
                  <Text variant="bodyMedium">{p.aisle || '-'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="labelSmall" style={{ color: '#666' }}>Mínimo</Text>
                  <Text variant="bodyMedium">{p.minStock || 10}</Text>
                </View>
              </View>

              {/* FOOTER: STOCK Y ACCIONES */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 5, backgroundColor: '#f9f9f9', padding: 8, borderRadius: 5 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text variant="bodyMedium" style={{ marginRight: 5 }}>Stock Total:</Text>
                  <Text variant="headlineSmall" style={{ fontWeight: 'bold', color: p.stock < (p.minStock || 10) ? 'red' : '#2E7D32' }}>{p.stock}</Text>
                </View>

                <View style={{ flexDirection: 'row' }}>
                  <IconButton
                    icon="pencil"
                    mode="contained"
                    containerColor="#E0E0E0"
                    iconColor="#333"
                    size={20}
                    onPress={() => openEdit(p)}
                  />
                  <IconButton
                    icon="trash-can-outline"
                    mode="contained"
                    containerColor="#FFEBEE"
                    iconColor="#D32F2F"
                    size={20}
                    onPress={() => openWaste(p)}
                  />
                </View>
              </View>
            </Card.Content>
          </Card>
        ))}
        {filteredProducts.length === 0 && <Text style={{ textAlign: 'center', marginTop: 20, color: '#999' }}>No se encontraron productos.</Text>}
      </ScrollView>

      <FAB
        icon="plus"
        label="Nuevo Producto"
        style={styles.fab}
        onPress={() => navigation.navigate('Ingreso', { openManual: true })}
        color="white"
      />

      <EditProductModal visible={editModalVisible} hide={() => setEditModalVisible(false)} product={selectedProduct} />
      <ReportWasteModal visible={wasteModalVisible} hide={() => setWasteModalVisible(false)} product={selectedProduct} />
    </View>
  );
}

// --- SUB-COMPONENTE: CONTEOS (MEJORADO UI/UX) ---
function CountHistoryList() {
  const [counts, setCounts] = useState([]);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedCount, setSelectedCount] = useState(null);

  // Filtros
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [showStatusMenu, setShowStatusMenu] = useState(false);

  const STATUS_OPTIONS = ["Todos", "Pendiente", "Cerrado", "Discrepancia"];

  useEffect(() => {
    const q = query(collection(db, "counts"), orderBy("date", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCounts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  const simulateCount = async () => {
    const randomId = Math.floor(1000 + Math.random() * 9000);
    const isPending = Math.random() > 0.5;

    // Generar items simulados
    const dummyItems = [
      { sku: '1001', name: 'Harina Selecta', expected: 50, counted: isPending ? 48 : 50 },
      { sku: '1002', name: 'Aceite Vegetal', expected: 30, counted: 30 },
      { sku: '1003', name: 'Azúcar Iansa', expected: 20, counted: isPending ? 15 : 20 },
    ];

    const totalExpected = dummyItems.reduce((acc, item) => acc + item.expected, 0);
    const totalCounted = dummyItems.reduce((acc, item) => acc + item.counted, 0);

    await addDoc(collection(db, "counts"), {
      countId: `CNT-${randomId}`,
      worker: 'Juan Pérez',
      aisle: isPending ? 'Pasillo A - Granos' : 'Cámara Frío 1',
      status: isPending ? 'Pendiente' : 'Cerrado',
      date: new Date(),
      expected: totalExpected,
      counted: totalCounted,
      items: dummyItems
    });
  };

  const handleViewDetail = (count) => {
    setSelectedCount(count);
    setDetailModalVisible(true);
  };

  const handleExport = async (count) => {
    if (!count.items || count.items.length === 0) {
      return Alert.alert("Error", "Este conteo no tiene detalles para exportar.");
    }

    try {
      let csvContent = "SKU,Producto,Esperado,Contado,Diferencia\n";
      count.items.forEach(item => {
        csvContent += `${item.sku},"${item.name}",${item.expected},${item.counted},${item.counted - item.expected}\n`;
      });

      const fileName = `Conteo_${count.countId}.csv`;
      const fileUri = FileSystem.cacheDirectory + fileName;

      await FileSystem.writeAsStringAsync(fileUri, csvContent, { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(fileUri);
    } catch (error) {
      Alert.alert("Error al exportar", error.message);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '-';
    const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Pendiente': return '#FFF3E0'; // Naranja claro
      case 'Cerrado': return '#E8F5E9'; // Verde claro
      case 'Discrepancia': return '#FFEBEE'; // Rojo claro
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

  const filteredCounts = counts.filter(c => {
    const matchesSearch =
      (c.countId && c.countId.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (c.worker && c.worker.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (c.aisle && c.aisle.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === 'Todos' || c.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <View style={{ flex: 1 }}>
      <View style={{ padding: 10, backgroundColor: 'white' }}>
        {/* FILTROS */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
          <View style={{ flex: 1 }}>
            <Searchbar
              placeholder="Buscar por ID, Bodeguero..."
              onChangeText={setSearchQuery}
              value={searchQuery}
              style={{ backgroundColor: '#f0f0f0', height: 45 }}
              inputStyle={{ minHeight: 0 }}
            />
          </View>
          <Menu
            visible={showStatusMenu}
            onDismiss={() => setShowStatusMenu(false)}
            anchor={
              <TouchableOpacity
                onPress={() => setShowStatusMenu(true)}
                style={{
                  flexDirection: 'row', alignItems: 'center',
                  borderWidth: 1, borderColor: '#ccc', borderRadius: 25,
                  paddingHorizontal: 15, height: 45, backgroundColor: 'white',
                  justifyContent: 'center'
                }}
              >
                <Text style={{ marginRight: 5, color: '#555' }}>{statusFilter}</Text>
                <MaterialCommunityIcons name="chevron-down" size={20} color="#666" />
              </TouchableOpacity>
            }
          >
            {STATUS_OPTIONS.map(status => (
              <Menu.Item key={status} onPress={() => { setStatusFilter(status); setShowStatusMenu(false); }} title={status} />
            ))}
          </Menu>
        </View>
      </View>

      <ScrollView style={styles.scroll}>
        {filteredCounts.length === 0 && (
          <View style={{ alignItems: 'center', marginTop: 50 }}>
            <MaterialCommunityIcons name="clipboard-text-outline" size={50} color="#ccc" />
            <Text style={{ textAlign: 'center', marginTop: 10, color: '#999' }}>No se encontraron conteos.</Text>
          </View>
        )}

        {filteredCounts.map((c) => (
          <Card key={c.id} style={[styles.card, { borderLeftWidth: 4, borderLeftColor: getStatusTextColor(c.status) }]}>
            <Card.Content>
              {/* HEADER: ID y ESTADO */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <MaterialCommunityIcons name="clipboard-list" size={20} color="#555" style={{ marginRight: 5 }} />
                  <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>{c.countId}</Text>
                </View>
                <Chip
                  compact
                  style={{ backgroundColor: getStatusColor(c.status) }}
                  textStyle={{ color: getStatusTextColor(c.status), fontWeight: 'bold', fontSize: 11 }}
                >
                  {c.status.toUpperCase()}
                </Chip>
              </View>

              <Divider style={{ marginBottom: 10 }} />

              {/* INFO PRINCIPAL: FECHA, BODEGUERO, UBICACIÓN */}
              <View style={{ marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5 }}>
                  <MaterialCommunityIcons name="calendar-clock" size={16} color="#666" style={{ width: 20 }} />
                  <Text variant="bodySmall" style={{ color: '#666', width: 80 }}>Fecha:</Text>
                  <Text variant="bodyMedium" style={{ fontWeight: '500' }}>{formatDate(c.date)}</Text>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5 }}>
                  <MaterialCommunityIcons name="account" size={16} color="#666" style={{ width: 20 }} />
                  <Text variant="bodySmall" style={{ color: '#666', width: 80 }}>Bodeguero:</Text>
                  <Text variant="bodyMedium" style={{ fontWeight: '500' }}>{c.worker}</Text>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <MaterialCommunityIcons name="map-marker" size={16} color="#666" style={{ width: 20 }} />
                  <Text variant="bodySmall" style={{ color: '#666', width: 80 }}>Ubicación:</Text>
                  <Text variant="bodyMedium" style={{ fontWeight: '500' }}>{c.aisle}</Text>
                </View>
              </View>

              {/* RESULTADOS DEL CONTEO */}
              <View style={{ backgroundColor: '#f9f9f9', padding: 10, borderRadius: 8, flexDirection: 'row', justifyContent: 'space-around' }}>
                <View style={{ alignItems: 'center' }}>
                  <Text variant="labelSmall" style={{ color: '#666' }}>Esperado</Text>
                  <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>{c.expected}</Text>
                </View>
                <View style={{ width: 1, backgroundColor: '#ddd' }} />
                <View style={{ alignItems: 'center' }}>
                  <Text variant="labelSmall" style={{ color: '#666' }}>Contado</Text>
                  <Text variant="titleMedium" style={{ fontWeight: 'bold', color: c.counted !== c.expected ? '#D32F2F' : '#2E7D32' }}>{c.counted}</Text>
                </View>
                {c.expected !== c.counted && (
                  <>
                    <View style={{ width: 1, backgroundColor: '#ddd' }} />
                    <View style={{ alignItems: 'center' }}>
                      <Text variant="labelSmall" style={{ color: '#D32F2F' }}>Diferencia</Text>
                      <Text variant="titleMedium" style={{ fontWeight: 'bold', color: '#D32F2F' }}>{c.counted - c.expected}</Text>
                    </View>
                  </>
                )}
              </View>

            </Card.Content>
            <Card.Actions style={{ justifyContent: 'flex-end', paddingTop: 0 }}>
              <Button mode="text" compact icon="eye" textColor="#666" onPress={() => handleViewDetail(c)}>Ver Detalle</Button>
              <Button mode="text" compact icon="file-excel" textColor="#2E7D32" onPress={() => handleExport(c)}>Exportar</Button>
            </Card.Actions>
          </Card>
        ))}
      </ScrollView>
      <FAB icon="plus" label="Nuevo Conteo" style={styles.fab} onPress={simulateCount} color="white" />

      <CountDetailModal visible={detailModalVisible} hide={() => setDetailModalVisible(false)} count={selectedCount} />
    </View>
  );
}

// --- SUB-COMPONENTE: KARDEX ---
function KardexList() {
  const [movements, setMovements] = useState([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const u = onSnapshot(query(collection(db, "kardex"), orderBy("date", "desc")), (s) => setMovements(s.docs.map(d => ({ id: d.id, ...d.data(), formattedDate: d.data().date?.toDate().toLocaleDateString() }))));
    return () => u();
  }, []);

  const filtered = movements.filter(m => m.productName?.toLowerCase().includes(search.toLowerCase()) || m.sku?.includes(search));

  return (
    <View style={{ flex: 1 }}>
      <View style={{ padding: 10, backgroundColor: 'white' }}>
        <Searchbar placeholder="Buscar..." onChangeText={setSearch} value={search} style={{ backgroundColor: '#f0f0f0' }} />
      </View>
      <ScrollView style={styles.scroll}>
        {filtered.map((m) => {
          const isEntry = m.type === 'Entrada';
          return (
            <View key={m.id} style={[styles.card, { padding: 15, flexDirection: 'row', alignItems: 'center' }]}>
              <MaterialCommunityIcons name={isEntry ? "arrow-up-bold-circle" : "arrow-down-bold-circle"} color={isEntry ? "green" : "#D32F2F"} size={30} />
              <View style={{ marginLeft: 15, flex: 1 }}>
                <Text style={{ fontWeight: 'bold' }}>{m.productName}</Text>
                <Text variant="bodySmall">SKU: {m.sku}</Text>
                <Text variant="bodySmall" style={{ color: '#666', fontSize: 10 }}>{m.reason || m.type} • {m.formattedDate}</Text>
              </View>
              <Text variant="titleMedium" style={{ fontWeight: 'bold', color: isEntry ? 'green' : '#D32F2F' }}>{isEntry ? '+' : '-'}{m.quantity}</Text>
            </View>
          );
        })}
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
  header: {
    backgroundColor: '#F36F21',
    paddingTop: 40,
    paddingBottom: 10,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 4
  },
  scroll: { flex: 1, padding: 10, backgroundColor: '#f0f0f0' },
  card: { marginBottom: 12, backgroundColor: 'white' },
  modal: { backgroundColor: 'white', padding: 20, margin: 20, borderRadius: 10 },
  input: { marginBottom: 12, backgroundColor: 'white' },
  fab: { position: 'absolute', margin: 16, right: 0, bottom: 0, backgroundColor: '#607D8B' }
});