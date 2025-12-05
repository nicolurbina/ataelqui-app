import React, { useState, useEffect } from 'react';
import { View, ScrollView, Image, Alert, StyleSheet, TouchableOpacity, Platform, useWindowDimensions } from 'react-native';
import { Text, TextInput, Button, Card, Chip, Searchbar, Modal, Portal, RadioButton, IconButton, Menu, Divider, List, Avatar } from 'react-native-paper';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
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
  const [route, setRoute] = useState('');
  const [driver, setDriver] = useState('');
  const [evidence, setEvidence] = useState(null);
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

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled) {
      setEvidence(result.assets[0].base64);
    }
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
      price: selectedProduct.price || 0,
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
        route,
        driver,
        evidence,
        warehouse,
        items,
        status: 'Pendiente',
        createdAt: new Date(),
        origin: 'Móvil'
      });
      Alert.alert("Éxito", "Devolución registrada correctamente");

      // Trigger Alert for New Return
      await addDoc(collection(db, "general_alerts"), {
        title: 'Nueva Devolución',
        desc: `Cliente: ${client}. Documento: ${docType} ${invoice}.`,
        type: 'Devolución',
        color: '#1976D2',
        icon: 'keyboard-return',
        date: new Date().toISOString().split('T')[0],
        isSystem: true
      });
      // Reset Form
      setClient('');
      setInvoice('');
      setVehicle('');
      setRoute('');
      setDriver('');
      setEvidence(null);
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
          <Text style={styles.label}>Vehículo / Patente</Text>
          <TextInput placeholder="Ej: AB-CD-12" value={vehicle} onChangeText={setVehicle} mode="outlined" style={styles.input} dense />
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Ruta</Text>
          <TextInput placeholder="Ej: Ruta 5" value={route} onChangeText={setRoute} mode="outlined" style={styles.input} dense />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Chofer / Bodeguero</Text>
          <TextInput placeholder="Nombre..." value={driver} onChangeText={setDriver} mode="outlined" style={styles.input} dense />
        </View>
      </View>

      <View style={{ marginBottom: 10 }}>
        <Text style={styles.label}>Evidencia (Foto)</Text>
        <TouchableOpacity onPress={pickImage} style={{ flexDirection: 'row', alignItems: 'center', padding: 10, borderWidth: 1, borderColor: '#ccc', borderRadius: 5, borderStyle: 'dashed' }}>
          <MaterialCommunityIcons name="camera" size={24} color="#666" style={{ marginRight: 10 }} />
          <Text style={{ color: '#666' }}>{evidence ? "Imagen Seleccionada" : "Adjuntar Foto"}</Text>
        </TouchableOpacity>
        {evidence && <Text style={{ color: 'green', fontSize: 12, marginTop: 5 }}>Imagen cargada correctamente</Text>}
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
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 10, borderBottomWidth: 1, borderBottomColor: '#eee' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MaterialCommunityIcons name="calendar" size={16} color="#666" style={{ marginRight: 5 }} />
                <Text variant="bodySmall" style={{ color: '#666' }}>
                  {item.date?.toDate ? item.date.toDate().toLocaleDateString() : new Date().toLocaleDateString()}
                </Text>
              </View>
              <Chip style={{ backgroundColor: '#FFF3E0' }} textStyle={{ color: '#E65100', fontSize: 10, fontWeight: 'bold' }}>PENDIENTE</Chip>
            </View>

            <Card.Content style={{ paddingTop: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>{item.client}</Text>
                <Text variant="bodyMedium" style={{ fontWeight: 'bold', color: '#555' }}>{item.docType} {item.invoice}</Text>
              </View>

              <Divider style={{ marginVertical: 8 }} />

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 15, marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <MaterialCommunityIcons name="truck-delivery" size={16} color="#666" style={{ marginRight: 5 }} />
                  <Text variant="bodySmall">{item.vehicle || '-'}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <MaterialCommunityIcons name="map-marker-path" size={16} color="#666" style={{ marginRight: 5 }} />
                  <Text variant="bodySmall">{item.route || '-'}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <MaterialCommunityIcons name="account" size={16} color="#666" style={{ marginRight: 5 }} />
                  <Text variant="bodySmall">{item.driver || '-'}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <MaterialCommunityIcons name="warehouse" size={16} color="#666" style={{ marginRight: 5 }} />
                  <Text variant="bodySmall">{item.warehouse || '-'}</Text>
                </View>
              </View>

              <View style={{ backgroundColor: '#f5f5f5', padding: 8, borderRadius: 5 }}>
                <Text variant="bodySmall" style={{ fontWeight: 'bold', marginBottom: 5 }}>Items ({item.items?.length || 0})</Text>
                {item.items?.map((i, idx) => (
                  <Text key={idx} variant="bodySmall" style={{ color: '#555' }}>• {i.productName} (x{i.quantity}) - {i.reason}</Text>
                ))}
              </View>

              {item.evidence && (
                <View style={{ marginTop: 10 }}>
                  <Text variant="bodySmall" style={{ fontWeight: 'bold', marginBottom: 5 }}>Evidencia</Text>
                  <Image source={{ uri: `data:image/jpeg;base64,${item.evidence}` }} style={{ width: 60, height: 60, borderRadius: 5 }} />
                </View>
              )}
            </Card.Content>

            <Card.Actions style={{ justifyContent: 'flex-end', borderTopWidth: 1, borderTopColor: '#eee', marginTop: 10 }}>
              <Button mode="outlined" textColor="red" onPress={() => handleAction(item.id, 'Rechazado')} style={{ borderColor: 'red', marginRight: 10 }}>Rechazar</Button>
              <Button mode="contained" buttonColor="green" onPress={() => handleAction(item.id, 'Aprobado')}>Aprobar</Button>
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
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  // Filters State
  const [date, setDate] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [origin, setOrigin] = useState('Todos los Orígenes');
  const [showOriginModal, setShowOriginModal] = useState(false);

  const [reason, setReason] = useState('Todos los Motivos');
  const [showReasonModal, setShowReasonModal] = useState(false);

  const ORIGINS = ["Todos los Orígenes", "Móvil", "Web"];
  const REASONS_FILTER = ["Todos los Motivos", "Producto Vencido", "Envase Dañado", "Error de Pedido", "Rechazo Cliente"];

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

  const onDateChange = (event, selected) => {
    setShowDatePicker(false);
    if (selected) setDate(selected);
  };

  const filtered = history.filter(item => {
    // Text Search
    const textMatch =
      (item.client && item.client.toLowerCase().includes(search.toLowerCase())) ||
      (item.id && item.id.toLowerCase().includes(search.toLowerCase())) ||
      (item.invoice && item.invoice.includes(search));

    // Date Filter
    let dateMatch = true;
    if (date) {
      dateMatch = item.jsDate.toDateString() === date.toDateString();
    }

    // Origin Filter
    let originMatch = true;
    if (origin !== 'Todos los Orígenes') {
      originMatch = item.origin === origin;
    }

    // Reason Filter
    let reasonMatch = true;
    if (reason !== 'Todos los Motivos') {
      reasonMatch = item.items?.some(i => i.reason === reason);
    }

    return textMatch && dateMatch && originMatch && reasonMatch;
  });

  // Table Column Widths
  const colWidths = {
    id: 0.1,
    fecha: 0.15,
    origen: 0.1,
    cliente: 0.25,
    items: 0.1,
    monto: 0.15,
    estado: 0.15
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F5F7FA' }}>
      {/* --- FILTER BAR --- */}
      <View style={[styles.filterContainer, isMobile && styles.filterContainerMobile]}>
        {isMobile ? (
          // MOBILE FILTER LAYOUT (Vertical Stack)
          <View style={{ gap: 10 }}>
            <TextInput
              placeholder="Buscar por Cliente o ID..."
              value={search}
              onChangeText={setSearch}
              mode="outlined"
              style={{ backgroundColor: 'white', height: 40 }}
              dense
              outlineStyle={{ borderRadius: 8, borderColor: '#E0E0E0' }}
            />

            <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.mobileFilterInput}>
              <Text style={{ flex: 1, color: date ? '#333' : '#999', fontSize: 12 }} numberOfLines={1}>
                {date ? date.toLocaleDateString() : "Filtrar Fecha"}
              </Text>
              <MaterialCommunityIcons name="calendar" size={20} color="#2196F3" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.mobileFilterInput} onPress={() => setShowOriginModal(true)}>
              <Text style={{ color: '#555', fontSize: 12 }}>{origin}</Text>
              <MaterialCommunityIcons name="chevron-down" size={20} color="#999" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.mobileFilterInput} onPress={() => setShowReasonModal(true)}>
              <Text style={{ color: '#555', fontSize: 12 }}>{reason}</Text>
              <MaterialCommunityIcons name="chevron-down" size={20} color="#999" />
            </TouchableOpacity>
          </View>
        ) : (
          // DESKTOP FILTER LAYOUT (Grid/Row)
          <>
            <View style={styles.filterRow}>
              <View style={{ flex: 2 }}>
                <TextInput
                  placeholder="Buscar por Cliente o ID..."
                  value={search}
                  onChangeText={setSearch}
                  mode="outlined"
                  style={{ backgroundColor: 'white', height: 40 }}
                  dense
                  outlineStyle={{ borderRadius: 8, borderColor: '#E0E0E0' }}
                />
              </View>
              <View style={{ flex: 1.5 }}>
                <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.desktopFilterInput}>
                  <Text style={{ flex: 1, color: date ? '#333' : '#999', fontSize: 12 }} numberOfLines={1}>
                    {date ? date.toLocaleDateString() : "Filtrar Fecha"}
                  </Text>
                  <MaterialCommunityIcons name="calendar" size={20} color="#2196F3" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.filterRow}>
              <TouchableOpacity style={styles.filterDropdown} onPress={() => setShowOriginModal(true)}>
                <Text style={{ color: '#555', fontSize: 12 }}>{origin}</Text>
                <MaterialCommunityIcons name="chevron-down" size={20} color="#999" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.filterDropdown} onPress={() => setShowReasonModal(true)}>
                <Text style={{ color: '#555', fontSize: 12 }}>{reason}</Text>
                <MaterialCommunityIcons name="chevron-down" size={20} color="#999" />
              </TouchableOpacity>
            </View>
          </>
        )}

        {showDatePicker && <DateTimePicker value={date || new Date()} mode="date" display="default" onChange={onDateChange} />}
      </View>

      {/* --- CONTENT --- */}
      {isMobile ? (
        // MOBILE CARD VIEW
        <ScrollView style={styles.listContainer}>
          {filtered.length === 0 && <Text style={{ textAlign: 'center', marginTop: 20, color: '#999' }}>No se encontraron resultados.</Text>}
          {filtered.map((item) => (
            <Card key={item.id} style={styles.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 10, borderBottomWidth: 1, borderBottomColor: '#eee' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <MaterialCommunityIcons name={(item.origin || 'Móvil') === 'Móvil' ? "cellphone" : "monitor"} size={16} color="#666" />
                  <Text style={{ fontSize: 12, color: '#666' }}>{item.jsDate.toLocaleDateString()}</Text>
                </View>
                <Text style={{ fontSize: 12, color: '#999' }}>ID: {item.id.slice(-6)}</Text>
              </View>
              <Card.Content style={{ paddingTop: 10 }}>
                <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>{item.client || "Sin Cliente"}</Text>
                <Text variant="bodySmall" style={{ color: '#555', marginBottom: 5 }}>{item.docType} {item.invoice}</Text>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
                  <View>
                    <Text variant="bodySmall" style={{ color: '#999' }}>Items</Text>
                    <Text variant="bodyMedium">{item.items?.length || 0}</Text>
                  </View>
                  <View>
                    <Text variant="bodySmall" style={{ color: '#999' }}>Monto Est.</Text>
                    <Text variant="bodyMedium">${(item.items?.reduce((sum, i) => sum + (i.quantity * (i.price || 0)), 0) || 0).toLocaleString()}</Text>
                  </View>
                  <View>
                    <Text variant="bodySmall" style={{ color: '#999' }}>Motivo</Text>
                    <Text variant="bodyMedium" numberOfLines={1} style={{ maxWidth: 100 }}>
                      {item.items?.length > 1 ? "Varios" : (item.items?.[0]?.reason || "-")}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Chip
                      style={{ backgroundColor: item.status === 'Aprobado' ? '#E8F5E9' : '#FFEBEE', height: 24 }}
                      textStyle={{ color: item.status === 'Aprobado' ? '#2E7D32' : '#C62828', fontSize: 10, fontWeight: 'bold', lineHeight: 12 }}
                    >
                      {item.status?.toUpperCase()}
                    </Chip>
                  </View>
                </View>
              </Card.Content>
            </Card>
          ))}
        </ScrollView>
      ) : (
        // DESKTOP/TABLET TABLE VIEW
        <View style={{ flex: 1, marginHorizontal: 10, marginBottom: 10, backgroundColor: 'white', borderRadius: 10, elevation: 2, overflow: 'hidden' }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', padding: 12, borderBottomWidth: 1, borderBottomColor: '#EEE', backgroundColor: '#FAFAFA' }}>
            <Text style={[styles.tableHeader, { flex: colWidths.id }]}>ID</Text>
            <Text style={[styles.tableHeader, { flex: colWidths.fecha }]}>FECHA</Text>
            <Text style={[styles.tableHeader, { flex: colWidths.origen }]}>ORIGEN</Text>
            <Text style={[styles.tableHeader, { flex: colWidths.cliente }]}>CLIENTE / RUTA</Text>
            <Text style={[styles.tableHeader, { flex: colWidths.items, textAlign: 'center' }]}>ITEMS</Text>
            <Text style={[styles.tableHeader, { flex: colWidths.monto, textAlign: 'right' }]}>MONTO EST.</Text>
            <Text style={[styles.tableHeader, { flex: colWidths.estado, textAlign: 'center' }]}>ESTADO</Text>
          </View>

          {/* List */}
          <ScrollView>
            {filtered.length === 0 ? (
              <Text style={{ textAlign: 'center', padding: 20, color: '#999' }}>No se encontraron resultados.</Text>
            ) : (
              filtered.map((item, index) => (
                <View key={item.id} style={{ flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#F5F5F5', alignItems: 'center' }}>
                  <Text style={[styles.tableCell, { flex: colWidths.id, color: '#999', fontSize: 10 }]} numberOfLines={1}>{item.id.slice(-6)}</Text>
                  <Text style={[styles.tableCell, { flex: colWidths.fecha }]}>{item.jsDate.toLocaleDateString()}</Text>
                  <View style={[styles.tableCell, { flex: colWidths.origen, flexDirection: 'row', alignItems: 'center', gap: 5 }]}>
                    <MaterialCommunityIcons name={(item.origin || 'Móvil') === 'Móvil' ? "cellphone" : "monitor"} size={16} color="#555" />
                    <Text style={{ fontSize: 11, color: '#555' }}>{item.origin || 'Móvil'}</Text>
                  </View>
                  <View style={{ flex: colWidths.cliente }}>
                    <Text style={{ fontWeight: 'bold', fontSize: 12, color: '#333' }} numberOfLines={1}>{item.client}</Text>
                    <Text style={{ fontSize: 10, color: '#999' }} numberOfLines={1}>{item.route || 'Sin Ruta'}</Text>
                  </View>
                  <Text style={[styles.tableCell, { flex: colWidths.items, textAlign: 'center' }]}>{item.items?.length || 0}</Text>
                  <Text style={[styles.tableCell, { flex: colWidths.monto, textAlign: 'right', color: '#555' }]}>
                    ${(item.items?.reduce((sum, i) => sum + (i.quantity * (i.price || 0)), 0) || 0).toLocaleString()}
                  </Text>
                  <View style={{ flex: colWidths.estado, alignItems: 'center' }}>
                    <Chip
                      style={{ backgroundColor: item.status === 'Aprobado' ? '#E8F5E9' : '#FFEBEE', height: 24 }}
                      textStyle={{ color: item.status === 'Aprobado' ? '#2E7D32' : '#C62828', fontSize: 9, fontWeight: 'bold', lineHeight: 10 }}
                    >
                      {item.status?.toUpperCase()}
                    </Chip>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        </View>
      )}

      {/* Modals */}
      <SelectionModal
        visible={showOriginModal}
        hide={() => setShowOriginModal(false)}
        title="Filtrar por Origen"
        items={ORIGINS}
        onSelect={setOrigin}
      />

      <SelectionModal
        visible={showReasonModal}
        hide={() => setShowReasonModal(false)}
        title="Filtrar por Motivo"
        items={REASONS_FILTER}
        onSelect={setReason}
      />
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
  label: { marginBottom: 5, fontWeight: 'bold', color: '#555' },
  filterContainer: {
    padding: 15,
    backgroundColor: 'white',
    borderRadius: 10,
    margin: 10,
    elevation: 2
  },
  filterContainerMobile: {
    padding: 10,
    gap: 10
  },
  filterRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10
  },
  filterRowMobile: {
    flexDirection: 'column',
    gap: 10,
    marginBottom: 0
  },
  filterDropdown: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    height: 40,
    paddingHorizontal: 10
  },
  tableHeader: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#999'
  },
  tableCell: {
    fontSize: 11,
    color: '#555'
  },
  mobileFilterInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    height: 40,
    paddingHorizontal: 10,
    backgroundColor: 'white',
    width: '100%'
  },
  desktopFilterInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    height: 40,
    paddingHorizontal: 10
  }
});