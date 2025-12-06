import { addDoc, collection, doc, getDocs, onSnapshot, orderBy, query, updateDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Alert, Keyboard, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Button, Card, FAB, IconButton, List, Modal, Portal, Text, TextInput } from 'react-native-paper';
import { db } from '../../firebaseConfig';

export default function WasteScreen() {
  const [wastes, setWastes] = useState([]);
  const [filter, setFilter] = useState('all');

  // ESTADOS DEL MODAL
  const [modalVisible, setModalVisible] = useState(false);

  // FORM STATE
  const [sku, setSku] = useState('');
  const [productName, setProductName] = useState('');
  const [qty, setQty] = useState('');
  const [cause, setCause] = useState('Vencido');
  const [lot, setLot] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [loading, setLoading] = useState(false);

  // SEARCH STATE
  const [allProducts, setAllProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [showProductList, setShowProductList] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  // CAUSES DROPDOWN
  const [showCauseMenu, setShowCauseMenu] = useState(false);
  const CAUSES = ["Vencido", "Daño"];

  useEffect(() => {
    // 1. Listen to Waste History
    const q = query(collection(db, "waste"), orderBy("date", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setWastes(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // 2. Fetch Products for Search
    const fetchProducts = async () => {
      const qP = query(collection(db, "products"));
      const snapshot = await getDocs(qP);
      setAllProducts(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    };
    fetchProducts();

    return () => unsubscribe();
  }, []);

  // --- SEARCH LOGIC ---
  const handleSearch = (text) => {
    setSku(text); // We use 'sku' state as the search input value temporarily
    if (text.length > 0) {
      const lower = text.toLowerCase();
      const results = allProducts.filter(p =>
        (p.name && p.name.toLowerCase().includes(lower)) ||
        (p.sku && p.sku.toLowerCase().includes(lower))
      );
      setFilteredProducts(results);
      setShowProductList(true);
    } else {
      setFilteredProducts([]);
      setShowProductList(false);
    }
  };

  const handleSelectProduct = (product) => {
    setSelectedProduct(product);
    setSku(product.sku); // Display SKU or Name in input? Let's display Name for better UX, but keep SKU for logic
    setProductName(product.name);
    setLot(product.lot || '');
    setUnitCost(product.cost ? String(product.cost) : '0');
    setShowProductList(false);
    Keyboard.dismiss();
  };

  // --- SUBMIT LOGIC ---
  const handleConfirmWaste = async () => {
    if (!selectedProduct || !qty) return Alert.alert("Error", "Selecciona un producto e ingresa la cantidad.");
    setLoading(true);

    try {
      const deduction = parseInt(qty);
      const currentStock = selectedProduct.stock || 0;

      // 1. Check Stock
      if (currentStock < deduction) {
        setLoading(false);
        return Alert.alert("Error", `Stock insuficiente. Tienes: ${currentStock}`);
      }

      // 2. Deduct Stock
      await updateDoc(doc(db, "products", selectedProduct.id), { stock: currentStock - deduction });

      // 3. Record Waste
      await addDoc(collection(db, "waste"), {
        sku: selectedProduct.sku,
        productName: selectedProduct.name,
        quantity: deduction,
        cause,
        lot,
        cost: parseFloat(unitCost) || 0,
        date: new Date(),
        user: "Bodeguero" // Replace with actual user if available
      });

      // 4. Record Kardex
      await addDoc(collection(db, "kardex"), {
        sku: selectedProduct.sku,
        productName: selectedProduct.name,
        type: "Salida",
        quantity: deduction,
        reason: `Merma (${cause})`,
        date: new Date(),
        user: "Bodeguero"
      });

      // 5. Alerts
      await addDoc(collection(db, "notifications"), {
        title: 'Merma Registrada',
        desc: `Producto: ${selectedProduct.name}. Cantidad: ${deduction}. Causa: ${cause}.`,
        type: 'Merma',
        color: '#795548',
        icon: 'trash-can',
        date: new Date().toISOString().split('T')[0],
        isSystem: true
      });

      // Low Stock Alert
      const minStock = selectedProduct.minStock || 10;
      if ((currentStock - deduction) <= minStock) {
        await addDoc(collection(db, "notifications"), {
          title: 'Quiebre de Stock',
          desc: `El producto ${selectedProduct.name} ha alcanzado el nivel crítico. Stock actual: ${currentStock - deduction}.`,
          type: 'Stock',
          color: '#D32F2F',
          icon: 'alert-octagon',
          date: new Date().toISOString().split('T')[0],
          isSystem: true
        });
      }

      Alert.alert("Éxito", "Merma registrada correctamente.");
      resetForm();
    } catch (e) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setModalVisible(false);
    setSku('');
    setProductName('');
    setQty('');
    setCause('Vencido');
    setLot('');
    setUnitCost('');
    setSelectedProduct(null);
    setFilteredProducts([]);
    setShowProductList(false);
    setShowCauseMenu(false);
  };

  const filteredList = filter === 'all' ? wastes : wastes.filter(w => w.cause.toLowerCase() === filter.toLowerCase());

  return (
    <View style={styles.container}>
      {/* HEADER & FILTERS */}
      <View style={{ padding: 15, backgroundColor: 'white', elevation: 2 }}>
        <Text variant="titleLarge" style={{ fontWeight: 'bold', marginBottom: 10 }}>Registro de Mermas</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {['All', 'Vencido', 'Daño'].map((f) => (
              <TouchableOpacity
                key={f}
                onPress={() => setFilter(f.toLowerCase())}
                style={[styles.filterChip, filter === f.toLowerCase() && styles.activeFilterChip]}
              >
                <Text style={{ color: filter === f.toLowerCase() ? 'white' : '#555' }}>{f === 'All' ? 'Todas' : f}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* LIST */}
      <ScrollView style={{ padding: 10 }}>
        {filteredList.map((item) => (
          <Card key={item.id} style={styles.card}>
            <Card.Content>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: 'bold', fontSize: 16 }}>{item.productName}</Text>
                  <Text variant="bodySmall" style={{ color: '#666' }}>SKU: {item.sku}</Text>
                </View>
                <Text style={{ color: '#D32F2F', fontWeight: 'bold', fontSize: 16 }}>-{item.quantity}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={styles.tag}><Text style={styles.tagText}>{item.cause}</Text></View>
                  {item.lot && <View style={styles.tag}><Text style={styles.tagText}>Lote: {item.lot}</Text></View>}
                </View>
                <Text variant="bodySmall" style={{ color: '#999' }}>{new Date(item.date.seconds * 1000).toLocaleDateString()}</Text>
              </View>
            </Card.Content>
          </Card>
        ))}
      </ScrollView>

      <FAB icon="plus" style={styles.fab} onPress={() => setModalVisible(true)} label="Nueva Merma" />

      {/* MODAL FORM */}
      <Portal>
        <Modal visible={modalVisible} onDismiss={resetForm} contentContainerStyle={styles.modalContainer}>
          <View onStartShouldSetResponder={() => true} onResponderRelease={() => Keyboard.dismiss()}>
            <View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>Registrar Nueva Merma</Text>
                <IconButton icon="close" size={20} onPress={resetForm} />
              </View>

              {/* Product Search */}
              <View style={{ zIndex: 100 }}>
                <Text style={styles.label}>Producto (Nombre o SKU)</Text>
                <TextInput
                  placeholder="Buscar por SKU o Nombre..."
                  value={productName || sku}
                  onChangeText={(t) => { setProductName(t); handleSearch(t); }}
                  mode="outlined"
                  style={styles.input}
                  dense
                  right={<TextInput.Icon icon="magnify" />}
                />
                {showProductList && (
                  <View style={styles.dropdown}>
                    <ScrollView style={{ maxHeight: 150 }} keyboardShouldPersistTaps="handled">
                      {filteredProducts.map((p) => (
                        <List.Item
                          key={p.id}
                          title={p.name}
                          description={`SKU: ${p.sku} | Stock: ${p.stock || 0}`}
                          onPress={() => handleSelectProduct(p)}
                          style={{ borderBottomWidth: 1, borderBottomColor: '#eee' }}
                        />
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>

              {/* Row 1: Lot & Qty */}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Lote</Text>
                  <TextInput value={lot} onChangeText={setLot} mode="outlined" style={styles.input} dense placeholder="L-2023-X" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Cantidad</Text>
                  <TextInput value={qty} onChangeText={setQty} keyboardType="numeric" mode="outlined" style={styles.input} dense placeholder="0" />
                </View>
              </View>

              {/* Row 2: Cause & Cost */}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Causa</Text>
                  <TouchableOpacity onPress={() => setShowCauseMenu(!showCauseMenu)}>
                    <TextInput
                      value={cause}
                      mode="outlined"
                      editable={false}
                      right={<TextInput.Icon icon="chevron-down" onPress={() => setShowCauseMenu(!showCauseMenu)} />}
                      style={styles.input}
                      dense
                    />
                  </TouchableOpacity>
                  {showCauseMenu && (
                    <View style={styles.dropdown}>
                      {CAUSES.map((c) => (
                        <List.Item key={c} title={c} onPress={() => { setCause(c); setShowCauseMenu(false); }} />
                      ))}
                    </View>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Costo Unitario</Text>
                  <TextInput value={unitCost} onChangeText={setUnitCost} keyboardType="numeric" mode="outlined" style={styles.input} dense placeholder="0" />
                </View>
              </View>

              {/* Buttons */}
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <Button mode="outlined" onPress={resetForm} textColor="#666" style={{ borderColor: '#ccc' }}>Cancelar</Button>
                <Button mode="contained" onPress={handleConfirmWaste} buttonColor="#D32F2F" loading={loading}>Registrar Pérdida</Button>
              </View>
            </View>
          </View>
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  card: { marginBottom: 10, backgroundColor: 'white', borderRadius: 8, elevation: 1 },
  fab: { position: 'absolute', margin: 16, right: 0, bottom: 0, backgroundColor: '#D32F2F' },
  modalContainer: { backgroundColor: 'white', padding: 20, margin: 20, borderRadius: 10 },
  input: { marginBottom: 15, backgroundColor: 'white', fontSize: 14 },
  label: { marginBottom: 5, color: '#555', fontWeight: '500', fontSize: 12 },
  dropdown: {
    position: 'absolute', top: 65, left: 0, right: 0,
    backgroundColor: 'white', borderWidth: 1, borderColor: '#eee', borderRadius: 5,
    elevation: 5, zIndex: 1000
  },
  filterChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    backgroundColor: '#E0E0E0', marginRight: 5
  },
  activeFilterChip: { backgroundColor: '#555' },
  tag: { backgroundColor: '#F5F5F5', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  tagText: { fontSize: 10, color: '#666' }
});