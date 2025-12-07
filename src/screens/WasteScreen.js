import { addDoc, collection, doc, getDocs, onSnapshot, orderBy, query, updateDoc, where } from 'firebase/firestore';
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
  const [searchText, setSearchText] = useState('');
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

  // BATCH STATE
  const [batches, setBatches] = useState([]);
  const [showBatchMenu, setShowBatchMenu] = useState(false);

  // CAUSES DROPDOWN
  const [showCauseMenu, setShowCauseMenu] = useState(false);
  const CAUSES = ["Vencido", "Daño", "Robo", "Consumo Interno", "Otro"];

  useEffect(() => {
    // 1. Listen to Waste History (using 'waste' collection)
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
    setSearchText(text);
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

  const handleSelectProduct = async (product) => {
    setSelectedProduct(product);
    setSearchText(product.name);

    // Reset batch/cost fields
    setLot('');
    setUnitCost('');
    setBatches([]);

    // Fetch batches from inventory
    try {
      console.log("Fetching batches for product:", product.id);
      const q = query(collection(db, "inventory"), where("productId", "==", product.id));
      const snapshot = await getDocs(q);
      const fetchedBatches = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      console.log("Fetched batches:", fetchedBatches);

      // Filter out batches with 0 quantity if desired, or keep all
      const availableBatches = fetchedBatches.filter(b => b.quantity > 0);
      console.log("Available batches (>0):", availableBatches);
      setBatches(availableBatches);

      // If no batches found, fallback to product data
      if (availableBatches.length === 0) {
        console.log("No batches found, using product fallback");
        setLot(product.batchNumber || product.lot || '');
        setUnitCost(product.cost ? String(product.cost) : (product.price ? String(product.price) : ''));
      }
    } catch (error) {
      console.error("Error fetching batches:", error);
      // Fallback on error
      setLot(product.batchNumber || product.lot || '');
      setUnitCost(product.cost ? String(product.cost) : (product.price ? String(product.price) : ''));
    }

    setShowProductList(false);
    Keyboard.dismiss();
  };

  const handleSelectBatch = (batch) => {
    setLot(batch.batch);
    // Use batch cost if available, otherwise fallback to product cost/price
    const cost = batch.unitCost !== undefined ? batch.unitCost : (selectedProduct?.cost || selectedProduct?.price || 0);
    setUnitCost(String(cost));
    setShowBatchMenu(false);
  };

  // --- SUBMIT LOGIC ---
  const handleConfirmWaste = async () => {
    if (!selectedProduct || !qty) return Alert.alert("Error", "Selecciona un producto e ingresa la cantidad.");
    setLoading(true);

    try {
      const deduction = parseInt(qty);
      const currentStock = selectedProduct.stock !== undefined ? selectedProduct.stock : (selectedProduct.quantity || 0);

      // 1. Check Stock
      if (currentStock < deduction) {
        setLoading(false);
        return Alert.alert("Error", `Stock insuficiente. Tienes: ${currentStock}`);
      }

      // 2. Deduct Stock
      await updateDoc(doc(db, "products", selectedProduct.id), { stock: currentStock - deduction });

      // 3. Record Waste (using "waste" collection)
      // Ensure SKU is never undefined/null
      const wasteData = {
        sku: selectedProduct.sku || "SIN-SKU",
        productName: selectedProduct.name,
        quantity: deduction,
        cause,
        lot,
        cost: parseFloat(unitCost) || 0,
        date: new Date(),
        user: "Bodeguero" // TODO: Use actual user if available
      };

      await addDoc(collection(db, "waste"), wasteData);

      // 4. Record Kardex
      await addDoc(collection(db, "kardex"), {
        sku: selectedProduct.sku || "SIN-SKU",
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
    setSearchText('');
    setQty('');
    setCause('Vencido');
    setLot('');
    setUnitCost('');
    setBatches([]);
    setSelectedProduct(null);
    setFilteredProducts([]);
    setShowProductList(false);
    setShowCauseMenu(false);
    setShowBatchMenu(false);
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
                  <Text variant="bodySmall" style={{ color: '#666' }}>SKU: {item.sku || 'N/A'}</Text>
                </View>
                <Text style={{ color: '#D32F2F', fontWeight: 'bold', fontSize: 16 }}>-{item.quantity}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={styles.tag}><Text style={styles.tagText}>{item.cause}</Text></View>
                  {item.lot && <View style={styles.tag}><Text style={styles.tagText}>Lote: {item.lot}</Text></View>}
                </View>
                <Text variant="bodySmall" style={{ color: '#999' }}>{item.date?.seconds ? new Date(item.date.seconds * 1000).toLocaleDateString() : '-'}</Text>
              </View>
            </Card.Content>
          </Card>
        ))}
      </ScrollView>

      <FAB icon="plus" style={styles.fab} onPress={() => setModalVisible(true)} label="Nueva Merma" />

      {/* MODAL FORM */}
      <Portal>
        <Modal visible={modalVisible} onDismiss={resetForm} contentContainerStyle={styles.modalContainer}>
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
                value={searchText}
                onChangeText={handleSearch}
                mode="outlined"
                style={styles.input}
                dense
                right={<TextInput.Icon icon="magnify" />}
              />

              {/* SKU DISPLAY */}
              {selectedProduct && (
                <View style={{ marginBottom: 10, marginTop: -10, marginLeft: 5 }}>
                  <Text style={{ color: '#2E7D32', fontWeight: 'bold', fontSize: 12 }}>
                    SKU Seleccionado: {selectedProduct.sku}
                  </Text>
                </View>
              )}

              {showProductList && (
                <View style={styles.dropdown}>
                  <ScrollView style={{ maxHeight: 150 }} keyboardShouldPersistTaps="handled">
                    {filteredProducts.map((p) => (
                      <List.Item
                        key={p.id}
                        title={p.name}
                        description={`SKU: ${p.sku} | Stock Total: ${p.totalStock !== undefined ? p.totalStock : (p.stock || 0)}`}
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
                <View>
                  <TextInput
                    value={lot}
                    onChangeText={setLot}
                    mode="outlined"
                    style={styles.input}
                    dense
                    placeholder="L-2023-X"
                    right={batches.length > 0 ? <TextInput.Icon icon="chevron-down" onPress={() => setShowBatchMenu(!showBatchMenu)} /> : null}
                  />
                  {showBatchMenu && batches.length > 0 && (
                    <View style={styles.dropdown}>
                      <ScrollView style={{ maxHeight: 150 }}>
                        {batches.map((b) => (
                          <List.Item
                            key={b.id}
                            title={`${b.batch} (Cant: ${b.quantity})`}
                            onPress={() => handleSelectBatch(b)}
                          />
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Cantidad</Text>
                <TextInput
                  value={qty}
                  onChangeText={setQty}
                  keyboardType="numeric"
                  mode="outlined"
                  style={styles.input}
                  dense
                  placeholder="0"
                />
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
                <TextInput
                  value={unitCost}
                  onChangeText={setUnitCost}
                  keyboardType="numeric"
                  mode="outlined"
                  style={styles.input}
                  dense
                  placeholder="0"
                />
              </View>
            </View>

            {/* Buttons */}
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
              <Button mode="outlined" onPress={resetForm} textColor="#666" style={{ borderColor: '#ccc' }}>Cancelar</Button>
              <Button mode="contained" onPress={handleConfirmWaste} buttonColor="#D32F2F" loading={loading}>Registrar Pérdida</Button>
            </View>
          </View>
        </Modal>
      </Portal>
    </View >
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
