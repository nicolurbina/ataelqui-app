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

// --- MODAL 1: EDITAR PRODUCTO (ESTANDARIZADO PARA API) ---
const EditProductModal = ({ visible, hide, product }) => {
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [provider, setProvider] = useState('');
  const [location, setLocation] = useState(''); // Antes aisle
  const [stock, setStock] = useState('');
  const [minStock, setMinStock] = useState('');
  const [price, setPrice] = useState(''); 
  const [cost, setCost] = useState('');   
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
      setPrice(String(product.price || ''));
      setCost(String(product.cost || ''));
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
        price: parseFloat(price),
        cost: parseFloat(cost),
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
                <TextInput value={provider} onChangeText={setProvider} mode="outlined" style={styles.input} dense />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={styles.label}>Ubicación</Text>
                <TextInput value={location} onChangeText={setLocation} mode="outlined" style={styles.input} dense />
            </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
                <Text style={styles.label}>Precio</Text>
                <TextInput value={price} onChangeText={setPrice} keyboardType="numeric" mode="outlined" style={styles.input} dense />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={styles.label}>Costo</Text>
                <TextInput value={cost} onChangeText={setCost} keyboardType="numeric" mode="outlined" style={styles.input} dense />
            </View>
        </View>

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

        <Button mode="contained" onPress={handleUpdate} loading={loading} buttonColor="#F36F21" style={{ marginTop: 20 }}>Actualizar</Button>
      </Modal>
    </Portal>
  );
};

// --- MODAL 2: REPORTAR MERMA (TU DISEÑO) ---
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
            <View style={{ flexDirection: 'row', alignItems: 'center' }}><RadioButton value="Daño" /><Text>Daño</Text></View>
          </View>
        </RadioButton.Group>
        <Button mode="contained" onPress={handleConfirmWaste} loading={loading} buttonColor="#D32F2F">Confirmar</Button>
        <Button mode="text" onPress={hide} style={{ marginTop: 5 }}>Cancelar</Button>
      </Modal>
    </Portal>
  );
};

// --- MODAL 3: DETALLE DE CONTEO (TU DISEÑO RECUPERADO) ---
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

// --- STOCK LIST (CON BUSCADOR Y CHIPS) ---
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
                    <View style={{ flex: 1 }}><Text variant="labelSmall" style={{ color: '#666' }}>Ubicación</Text><Text variant="bodyMedium">{displayLoc}</Text></View>
                    <View style={{ flex: 1 }}><Text variant="labelSmall" style={{ color: '#666' }}>Mínimo</Text><Text variant="bodyMedium">{p.minStock || 10}</Text></View>
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

// --- HISTORIAL DE CONTEOS (TU CÓDIGO RESTAURADO) ---
function CountHistoryList() {
  const [counts, setCounts] = useState([]);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
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

  const simulateCount = async () => {
    const randomId = Math.floor(1000 + Math.random() * 9000);
    const isPending = Math.random() > 0.5;
    await addDoc(collection(db, "counts"), {
      countId: `CNT-${randomId}`,
      worker: 'Juan Pérez',
      aisle: isPending ? 'Pasillo A' : 'Cámara Frío 1',
      status: isPending ? 'Pendiente' : 'Cerrado',
      date: new Date(),
      expected: 100,
      counted: isPending ? 95 : 100,
      items: [{ sku: '1001', name: 'Harina Selecta', expected: 50, counted: isPending ? 48 : 50 }]
    });
  };

  const handleViewDetail = (count) => { setSelectedCount(count); setDetailModalVisible(true); };
  
  const handleExport = async (count) => {
    // Lógica básica de exportación
    Alert.alert("Exportar", "Simulando descarga de Excel...");
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
                <Chip compact style={{ backgroundColor: getStatusColor(c.status) }} textStyle={{ color: getStatusTextColor(c.status), fontWeight: 'bold', fontSize: 11 }}>{c.status.toUpperCase()}</Chip>
              </View>
              <Divider style={{ marginBottom: 10 }} />
              <View style={{ marginBottom: 10 }}>
                <Text variant="bodySmall">Fecha: {formatDate(c.date)}</Text>
                <Text variant="bodySmall">Bodeguero: {c.worker}</Text>
                <Text variant="bodySmall">Ubicación: {c.aisle}</Text>
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
      <FAB icon="plus" label="Simular Conteo" style={styles.fab} onPress={simulateCount} color="white" />
      <CountDetailModal visible={detailModalVisible} hide={() => setDetailModalVisible(false)} count={selectedCount} />
    </View>
  );
}

// --- KARDEX (MANTENIDO) ---
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