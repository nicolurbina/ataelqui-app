import React, { useState, useEffect } from 'react';
import { View, ScrollView, Image, Alert, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Text, TextInput, Button, Card, Chip, Searchbar, Modal, Portal, RadioButton, IconButton, Menu, Divider, List } from 'react-native-paper';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { db } from '../../firebaseConfig';
import { collection, addDoc, onSnapshot, query, where, orderBy, doc, updateDoc, getDocs } from 'firebase/firestore';

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

// --- PESTAÑA 1: NUEVA DEVOLUCIÓN ---
function NewReturnForm() {
  // Header State
  const [client, setClient] = useState('');
  const [docType, setDocType] = useState('Factura');
  const [invoice, setInvoice] = useState('');
  const [date, setDate] = useState(new Date());
  const [vehicle, setVehicle] = useState('');
  const [warehouse, setWarehouse] = useState('');

  // UI State
  const [showDocTypeModal, setShowDocTypeModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showWarehouseModal, setShowWarehouseModal] = useState(false);
  const [loading, setLoading] = useState(false);

  // Product Detail State
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showProductModal, setShowProductModal] = useState(false);
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState('Seleccionar...');
  const [showReasonModal, setShowReasonModal] = useState(false);

  // Items List
  const [items, setItems] = useState([]);

  const DOC_TYPES = ["Factura", "Boleta", "Otro (Movimiento Interno)"];
  const REASONS = ["Producto Vencido", "Envase Dañado", "Error de Pedido", "Rechazo Cliente"];
  const WAREHOUSES = ["Bodega 1", "Bodega 2", "Bodega 3", "Bodega 4", "Bodega 5", "Cámara de Frío"];

  useEffect(() => {
    const q = query(collection(db, "products"), orderBy("name"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setProducts(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsubscribe();
  }, []);

  const onDateChange = (event, selected) => {
    setShowDatePicker(false);
    if (selected) setDate(selected);
  };

  const handleAddItem = () => {
    if (!selectedProduct || !qty || reason === 'Seleccionar...') {
      return Alert.alert("Error", "Completa los datos del producto");
    }
    const newItem = {
      productName: selectedProduct.name,
      sku: selectedProduct.sku,
      quantity: parseInt(qty),
      reason,
      id: Date.now().toString() // temporary ID
    };
    setItems([...items, newItem]);
    // Reset product fields
    setSelectedProduct(null);
    setQty('');
    setReason('Seleccionar...');
  };

  const handleRemoveItem = (id) => {
    setItems(items.filter(i => i.id !== id));
  };

  const handleSubmit = async () => {
    if (!client || !invoice || !vehicle || !warehouse || items.length === 0) {
      return Alert.alert("Error", "Faltan datos obligatorios o productos");
    }
    setLoading(true);
    try {
      await addDoc(collection(db, "returns"), {
        client,
        docType,
        invoice,
        date,
        vehicle,
        warehouse,
        items,
        status: 'Pendiente',
        createdAt: new Date(),
        origin: 'Móvil'
      });
      Alert.alert("Éxito", "Devolución registrada correctamente");
      // Reset Form
      setClient('');
      setInvoice('');
      setVehicle('');
      setWarehouse('');
      setItems([]);
      setDate(new Date());
    } catch (e) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
    }
  };

  // Filter products by warehouse
  const filteredProducts = warehouse
    ? products.filter(p => (p.location === warehouse || p.aisle === warehouse))
    : [];

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <Text variant="titleMedium" style={{ color: '#F36F21', fontWeight: 'bold', marginBottom: 15 }}>Nueva Devolución</Text>

      {/* Header Fields */}
      <Text style={styles.label}>Cliente</Text>
      <TextInput placeholder="Nombre del Cliente..." value={client} onChangeText={setClient} mode="outlined" style={styles.input} dense />

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Tipo de Documento</Text>
          <TouchableOpacity onPress={() => setShowDocTypeModal(true)}>
            <TextInput value={docType} mode="outlined" editable={false} right={<TextInput.Icon icon="chevron-down" onPress={() => setShowDocTypeModal(true)} />} style={styles.input} dense />
          </TouchableOpacity>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>
            {docType === 'Factura' ? 'N° Factura' : docType === 'Boleta' ? 'N° Boleta' : 'N° Referencia / Guía'}
          </Text>
          <TextInput placeholder="Ej: 123456" value={invoice} onChangeText={setInvoice} mode="outlined" style={styles.input} dense keyboardType="numeric" />
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Fecha de Devolución</Text>
          <TouchableOpacity onPress={() => setShowDatePicker(true)}>
            <TextInput value={date.toLocaleDateString()} mode="outlined" editable={false} right={<TextInput.Icon icon="calendar" onPress={() => setShowDatePicker(true)} />} style={styles.input} dense />
          </TouchableOpacity>
          {showDatePicker && <DateTimePicker value={date} mode="date" display="default" onChange={onDateChange} />}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Vehículo / Transporte</Text>
          <TextInput placeholder="Ej: Citroen..." value={vehicle} onChangeText={setVehicle} mode="outlined" style={styles.input} dense />
        </View>
      </View>

      <View style={{ marginBottom: 10 }}>
        <Text style={styles.label}>Bodega</Text>
        <TouchableOpacity onPress={() => setShowWarehouseModal(true)}>
          <TextInput value={warehouse || "Seleccionar Bodega..."} mode="outlined" editable={false} right={<TextInput.Icon icon="chevron-down" onPress={() => setShowWarehouseModal(true)} />} style={styles.input} dense />
        </TouchableOpacity>
      </View>

      <Divider style={{ marginVertical: 15 }} />

      {/* Product Detail Section */}
      <Text variant="titleMedium" style={{ fontWeight: 'bold', marginBottom: 10 }}>Detalle del Producto</Text>

      <View style={{ marginBottom: 10 }}>
        <Text style={styles.label}>Producto</Text>
        <TouchableOpacity onPress={() => {
          if (!warehouse) {
            Alert.alert("Atención", "Seleccione una bodega primero");
            return;
          }
          setShowProductModal(true);
        }}>
          <TextInput
            value={selectedProduct ? selectedProduct.name : "Seleccionar Producto..."}
            mode="outlined"
            editable={false}
            right={<TextInput.Icon icon="chevron-down" onPress={() => {
              if (!warehouse) {
                Alert.alert("Atención", "Seleccione una bodega primero");
                return;
              }
              setShowProductModal(true);
            }} />}
            style={styles.input}
            dense
          />
        </TouchableOpacity>
      </View>

      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-end' }}>
        <View style={{ width: 80 }}>
          <Text style={styles.label}>Cantidad</Text>
          <TextInput value={qty} onChangeText={setQty} keyboardType="numeric" mode="outlined" style={styles.input} dense />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Motivo</Text>
          <TouchableOpacity onPress={() => setShowReasonModal(true)}>
            <TextInput value={reason} mode="outlined" editable={false} right={<TextInput.Icon icon="chevron-down" onPress={() => setShowReasonModal(true)} />} style={styles.input} dense />
          </TouchableOpacity>
        </View>
        <Button mode="contained" icon="plus" onPress={handleAddItem} style={{ marginBottom: 12, height: 46, justifyContent: 'center' }} buttonColor="#E0E0E0" textColor="#333"></Button>
      </View>

      {/* Items List */}
      <View style={{ marginTop: 10, minHeight: 100 }}>
        {items.length === 0 ? (
          <Text style={{ textAlign: 'center', color: '#999', marginTop: 20 }}>No hay productos agregados</Text>
        ) : (
          items.map((item, index) => (
            <View key={index} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f9f9f9', padding: 10, borderRadius: 5, marginBottom: 5 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: 'bold' }}>{item.productName}</Text>
                <Text variant="bodySmall">{item.reason}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ fontWeight: 'bold', marginRight: 10 }}>x{item.quantity}</Text>
                <IconButton icon="trash-can-outline" size={20} iconColor="red" onPress={() => handleRemoveItem(item.id)} />
              </View>
            </View>
          ))
        )}
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
        <Button mode="outlined" onPress={() => { setItems([]); setClient(''); setInvoice(''); setVehicle(''); setWarehouse(''); }} textColor="#666">Cancelar</Button>
        <Button mode="contained" onPress={handleSubmit} loading={loading} buttonColor="#F36F21">Registrar Devolución</Button>
      </View>

      {/* MODALS */}
      <SelectionModal
        visible={showDocTypeModal}
        hide={() => setShowDocTypeModal(false)}
        title="Tipo de Documento"
        items={DOC_TYPES}
        onSelect={setDocType}
      />

      <SelectionModal
        visible={showWarehouseModal}
        hide={() => setShowWarehouseModal(false)}
        title="Seleccionar Bodega"
        items={WAREHOUSES}
        onSelect={(w) => { setWarehouse(w); setSelectedProduct(null); }}
      />

      <SelectionModal
        visible={showReasonModal}
        hide={() => setShowReasonModal(false)}
        title="Motivo de Devolución"
        items={REASONS}
        onSelect={setReason}
      />

      <SelectionModal
        visible={showProductModal}
        hide={() => setShowProductModal(false)}
        title="Seleccionar Producto"
        items={filteredProducts}
        onSelect={setSelectedProduct}
        renderItem={(item, onSelect) => (
          <List.Item
            title={item.name}
            description={`SKU: ${item.sku}`}
            onPress={onSelect}
            left={props => <List.Icon {...props} icon="package-variant" color="#F36F21" />}
          />
        )}
      />

    </ScrollView>
  );
}

// --- MODAL EDICIÓN ---
const EditModal = ({ visible, hide, data }) => {
  const [editTruck, setEditTruck] = useState('');
  const [editStatus, setEditStatus] = useState('');

  useEffect(() => {
    if (data) { setEditTruck(data.truck); setEditStatus(data.status); }
  }, [data]);

  const handleUpdate = async () => {
    try {
      await updateDoc(doc(db, "returns", data.id), { truck: editTruck, status: editStatus });
      hide();
    } catch (e) { Alert.alert("Error", e.message); }
  };

  if (!data) return null;
  return (
    <Portal>
      <Modal visible={visible} onDismiss={hide} contentContainerStyle={styles.modal}>
        <Text variant="headlineSmall" style={{ marginBottom: 15 }}>Editar</Text>
        <TextInput label="Camión" value={editTruck} onChangeText={setEditTruck} mode="outlined" style={styles.input} />
        <RadioButton.Group onValueChange={setEditStatus} value={editStatus}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 10 }}><RadioButton value="Pendiente" /><Text>Pendiente</Text></View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 10 }}><RadioButton value="Aprobado" /><Text>Aprobado</Text></View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}><RadioButton value="Rechazado" /><Text>Rechazado</Text></View>
          </View>
        </RadioButton.Group>
        <Button mode="contained" onPress={handleUpdate} buttonColor="#F36F21" style={{ marginTop: 20 }}>Guardar</Button>
      </Modal>
    </Portal>
  );
};

// --- PESTAÑA 2: LISTA POR APROBAR ---
function ReturnsList({ statusFilter }) {
  const [list, setList] = useState([]);
  const [editingItem, setEditingItem] = useState(null);

  useEffect(() => {
    let q = query(collection(db, "returns"), orderBy("date", "desc"));
    if (statusFilter) q = query(collection(db, "returns"), where("status", "==", statusFilter));
    const unsubscribe = onSnapshot(q, (s) => setList(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => unsubscribe();
  }, [statusFilter]);

  const handleAction = async (id, newStatus) => {
    await updateDoc(doc(db, "returns", id), { status: newStatus });
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.listContainer}>
        {list.map((item) => (
          <Card key={item.id} style={styles.card}>
            <Card.Title title={item.truck} subtitle={item.invoice} right={(props) => <Chip {...props} style={{ marginRight: 10 }}>{item.status}</Chip>} />
            <Card.Content><Text>Cliente: {item.client}</Text></Card.Content>

            <Card.Actions>
              <Button icon="pencil" onPress={() => setEditingItem(item)}>Editar</Button>

              {item.status === 'Pendiente' && (
                <Button textColor="red" onPress={() => handleAction(item.id, 'Rechazado')}>Rechazar</Button>
              )}

              {item.status === 'Pendiente' && (
                <Button textColor="green" onPress={() => handleAction(item.id, 'Aprobado')}>Aprobar</Button>
              )}
            </Card.Actions>

          </Card>
        ))}
      </ScrollView>
      <EditModal visible={!!editingItem} hide={() => setEditingItem(null)} data={editingItem} />
    </View>
  );
}

// --- PESTAÑA 3: HISTORIAL CON BÚSQUEDA Y FECHA ---
function ReturnsHistory() {
  const [history, setHistory] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedDate, setSelectedDate] = useState(null);
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "returns"), orderBy("date", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const all = snapshot.docs.map(doc => {
        const data = doc.data();
        return { id: doc.id, ...data, jsDate: data.date?.toDate ? data.date.toDate() : new Date() };
      });
      setHistory(all.filter(i => i.status !== 'Pendiente'));
    });
    return () => unsubscribe();
  }, []);

  const onDateChange = (event, date) => {
    setShowPicker(false);
    if (date) setSelectedDate(date);
  };

  const filtered = history.filter(item => {
    const textMatch =
      (item.client && item.client.toLowerCase().includes(search.toLowerCase())) ||
      (item.invoice && item.invoice.includes(search)) ||
      (item.truck && item.truck.toLowerCase().includes(search.toLowerCase()));

    let dateMatch = true;
    if (selectedDate) dateMatch = item.jsDate.toDateString() === selectedDate.toDateString();

    return textMatch && dateMatch;
  });

  return (
    <View style={{ flex: 1, backgroundColor: '#f0f0f0' }}>
      <View style={{ backgroundColor: 'white', padding: 10 }}>
        <Searchbar placeholder="Buscar Cliente, Factura..." onChangeText={setSearch} value={search} style={{ marginBottom: 10, backgroundColor: '#f0f0f0' }} />
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Button mode="outlined" icon="calendar" onPress={() => setShowPicker(true)} style={{ flex: 1, marginRight: 10 }}>
            {selectedDate ? selectedDate.toLocaleDateString() : "Filtrar por Fecha"}
          </Button>
          {selectedDate && <IconButton icon="close-circle" size={24} onPress={() => setSelectedDate(null)} />}
        </View>
        {showPicker && <DateTimePicker value={selectedDate || new Date()} mode="date" display="default" onChange={onDateChange} />}
      </View>

      <ScrollView style={styles.listContainer}>
        {filtered.length === 0 && <Text style={{ textAlign: 'center', marginTop: 20, color: '#999' }}>No se encontraron resultados.</Text>}
        {filtered.map((item) => (
          <Card key={item.id} style={styles.card}>
            <Card.Title
              title={item.client || "Sin Cliente"}
              subtitle={item.jsDate.toLocaleDateString()}
              right={(props) => (
                <Text {...props} style={{ color: item.status === 'Aprobado' ? 'green' : 'red', fontWeight: 'bold', marginRight: 15 }}>
                  {item.status?.toUpperCase()}
                </Text>
              )}
            />
            <Card.Content>
              <Text style={{ fontWeight: 'bold' }}>Factura: {item.invoice}</Text>
              <Text variant="bodySmall" style={{ color: '#666' }}>Camión: {item.truck} | Motivo: {item.reason}</Text>
            </Card.Content>
          </Card>
        ))}
      </ScrollView>
    </View>
  );
}

const TopTab = createMaterialTopTabNavigator();
export default function ReturnsScreen() {
  return (
    <TopTab.Navigator screenOptions={{ tabBarLabelStyle: { fontSize: 11, fontWeight: 'bold' }, tabBarIndicatorStyle: { backgroundColor: '#F36F21' } }}>
      <TopTab.Screen name="Nueva" component={NewReturnForm} />
      <TopTab.Screen name="Por Aprobar">
        {() => <ReturnsList statusFilter="Pendiente" />}
      </TopTab.Screen>
      <TopTab.Screen name="Historial" component={ReturnsHistory} />
    </TopTab.Navigator>
  );
}

const styles = StyleSheet.create({
  scrollContainer: { padding: 20, backgroundColor: '#fff', flexGrow: 1 },
  listContainer: { flex: 1, padding: 10 },
  input: { marginBottom: 12, backgroundColor: 'white' },
  card: { marginBottom: 10, backgroundColor: 'white' },
  modal: { backgroundColor: 'white', padding: 20, margin: 20, borderRadius: 10 },
  label: { marginBottom: 5, fontWeight: 'bold', color: '#555' }
});