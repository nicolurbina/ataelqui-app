import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Alert, TouchableOpacity, Image, useWindowDimensions } from 'react-native';
import { Text, TextInput, Button, Card, Divider, IconButton, Modal, Portal, RadioButton, List, Chip } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { collection, addDoc, query, where, getDocs, updateDoc, doc, onSnapshot, orderBy } from 'firebase/firestore';
import { db, auth } from '../../firebaseConfig';

// --- CONSTANTS ---
const DOC_TYPES = ["Factura", "Boleta", "Guía de Despacho"];
const REASONS = ["Producto Vencido", "Envase Dañado", "Error de Pedido", "Rechazo Cliente"];

// --- SELECTION MODAL COMPONENT ---
const SelectionModal = ({ visible, hide, title, items, onSelect, renderItem }) => (
  <Portal>
    <Modal visible={visible} onDismiss={hide} contentContainerStyle={styles.modal}>
      <Text variant="headlineSmall" style={{ marginBottom: 15 }}>{title}</Text>
      <ScrollView style={{ maxHeight: 300 }}>
        {items.map((item, index) => (
          renderItem ? (
            <React.Fragment key={index}>{renderItem(item, () => { onSelect(item); hide(); })}</React.Fragment>
          ) : (
            <List.Item
              key={index}
              title={item}
              onPress={() => { onSelect(item); hide(); }}
              left={props => <List.Icon {...props} icon="check-circle-outline" />}
            />
          )
        ))}
      </ScrollView>
      <Button mode="text" onPress={hide} style={{ marginTop: 10 }}>Cancelar</Button>
    </Modal>
  </Portal>
);

// --- PESTAÑA 1: FORMULARIO DE NUEVA DEVOLUCIÓN ---
function NewReturnForm({ onReturnCreated }) {
  const [client, setClient] = useState('');
  const [docType, setDocType] = useState('Factura');
  const [invoice, setInvoice] = useState('');
  const [date, setDate] = useState(new Date());
  const [vehicle, setVehicle] = useState('');
  const [route, setRoute] = useState('');
  const [driver, setDriver] = useState('');
  const [evidence, setEvidence] = useState(null); // Stores base64 string
  const [observations, setObservations] = useState('');

  const [items, setItems] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState('Producto Vencido');

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);

  // Modals Visibility
  const [showDocTypeModal, setShowDocTypeModal] = useState(false);
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "products"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  const onDateChange = (event, selectedDate) => {
    setShowDatePicker(false);
    if (selectedDate) setDate(selectedDate);
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchCameraAsync({
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
    if (!selectedProduct || !qty) return Alert.alert("Error", "Selecciona producto y cantidad");
    setItems([...items, {
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      sku: selectedProduct.sku,
      price: selectedProduct.price || 0, // Default price to 0 if undefined
      quantity: parseInt(qty),
      reason
    }]);
    setSelectedProduct(null);
    setQty('');
  };

  const handleRemoveItem = (index) => {
    const newItems = [...items];
    newItems.splice(index, 1);
    setItems(newItems);
  };

  const handleSubmit = async () => {
    if (!client || !invoice || items.length === 0) return Alert.alert("Error", "Completa los campos obligatorios");
    setLoading(true);

    try {
      await addDoc(collection(db, "returns"), {
        client, docType, invoice, date,
        vehicle: vehicle || '', // Ensure not undefined
        route: route || '', // Ensure not undefined
        driver: driver || '', // Ensure not undefined
        items,
        status: 'Pendiente',
        evidence: evidence || null, // Ensure not undefined
        observations: observations || '', // Ensure not undefined
        createdAt: new Date()
      });

      Alert.alert("Éxito", "Devolución registrada correctamente");
      setItems([]); setClient(''); setInvoice(''); setVehicle(''); setRoute(''); setDriver(''); setEvidence(null); setObservations('');
      if (onReturnCreated) onReturnCreated();
    } catch (e) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 20 }}>
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
          <TextInput placeholder="Ej: Citroen, Camión 01..." value={vehicle} onChangeText={setVehicle} mode="outlined" style={styles.input} dense />
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
        <Text style={styles.label}>Observaciones / Descripción del Motivo</Text>
        <TextInput
          placeholder="Detalles adicionales sobre la devolución..."
          value={observations}
          onChangeText={setObservations}
          mode="outlined"
          style={[styles.input, { height: 80 }]}
          multiline
          numberOfLines={4}
          dense
        />
      </View>

      <Divider style={{ marginVertical: 15 }} />

      {/* Product Detail Section */}
      <Text variant="titleMedium" style={{ fontWeight: 'bold', marginBottom: 10 }}>Detalle del Producto</Text>

      <View style={{ marginBottom: 10 }}>
        <Text style={styles.label}>Producto</Text>
        <TouchableOpacity onPress={() => {
          setShowProductModal(true);
        }}>
          <TextInput
            value={selectedProduct ? selectedProduct.name : "Seleccionar Producto..."}
            mode="outlined"
            editable={false}
            right={<TextInput.Icon icon="chevron-down" onPress={() => {
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
        <Button mode="outlined" onPress={() => { setItems([]); setClient(''); setInvoice(''); setVehicle(''); setRoute(''); setDriver(''); setEvidence(null); setObservations(''); }} textColor="#666">Cancelar</Button>
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
        items={products}
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
    try {
      if (newStatus === 'Aprobado') {
        const returnDoc = list.find(r => r.id === id);
        if (!returnDoc) return;

        for (const item of returnDoc.items) {
          const isWaste = ["Producto Vencido", "Envase Dañado"].includes(item.reason);

          if (isWaste) {
            // --- CASE 1: WASTE (MERMA) ---
            // NO DESCONTAMOS STOCK (El producto ya salió y vuelve malo)
            const q = query(collection(db, "products"), where("sku", "==", item.sku));
            const snapshot = await getDocs(q);

            let cost = 0;
            let lot = 'N/A';

            if (!snapshot.empty) {
              const productData = snapshot.docs[0].data();
              cost = productData.cost || 0;
              lot = productData.lot || 'N/A';
            }

            await addDoc(collection(db, "waste"), {
              sku: item.sku,
              productName: item.productName,
              quantity: item.quantity,
              cause: item.reason,
              date: new Date(),
              origin: `Devolución ${returnDoc.id}`,
              cost: cost,
              lot: lot
            });

            await addDoc(collection(db, "general_alerts"), {
              title: 'Merma por Devolución',
              desc: `Producto: ${item.productName}. Cantidad: ${item.quantity}. Causa: ${item.reason}.`,
              type: 'Merma',
              color: '#795548',
              icon: 'trash-can',
              date: new Date().toISOString().split('T')[0],
              isSystem: true
            });

            await addDoc(collection(db, "kardex"), {
              sku: item.sku,
              productName: item.productName,
              type: "Merma",
              quantity: item.quantity,
              reason: `Devolución (${item.reason})`,
              date: new Date(),
              user: "Sistema"
            });

          } else {
            // --- CASE 2: GOOD CONDITION (STOCK) ---
            const q = query(collection(db, "products"), where("sku", "==", item.sku));
            const snapshot = await getDocs(q);

            if (!snapshot.empty) {
              const productDoc = snapshot.docs[0];
              const currentStock = productDoc.data().stock || 0;
              const newStock = currentStock + item.quantity;
              await updateDoc(doc(db, "products", productDoc.id), { stock: newStock });

              await addDoc(collection(db, "kardex"), {
                sku: item.sku,
                productName: item.productName,
                type: "Entrada",
                quantity: item.quantity,
                reason: `Devolución Cliente (${returnDoc.client})`,
                date: new Date(),
                user: "Sistema"
              });
            }
          }
        }
        Alert.alert("Aprobado", "Inventario y Mermas actualizados correctamente.");
      }

      await updateDoc(doc(db, "returns", id), { status: newStatus });
    } catch (e) {
      Alert.alert("Error", "No se pudo actualizar el estado: " + e.message);
    }
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
                  <Image
                    source={{ uri: item.evidence && item.evidence.startsWith('http') ? item.evidence : `data:image/jpeg;base64,${item.evidence}` }}
                    style={{ width: 60, height: 60, borderRadius: 5 }}
                  />
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
    items: 0.25, // Increased width for items
    monto: 0.15,
    estado: 0.15 // Reduced slightly if needed, or adjust total > 1 (flex works relatively)
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
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>{item.client || "Sin Cliente"}</Text>
                    <Text variant="bodySmall" style={{ color: '#555', marginBottom: 5 }}>{item.docType} {item.invoice}</Text>
                  </View>
                  <Chip
                    style={{ backgroundColor: item.status === 'Aprobado' ? '#E8F5E9' : '#FFEBEE', height: 24 }}
                    textStyle={{ color: item.status === 'Aprobado' ? '#2E7D32' : '#C62828', fontSize: 10, fontWeight: 'bold', lineHeight: 12 }}
                  >
                    {item.status?.toUpperCase()}
                  </Chip>
                </View>

                <Divider style={{ marginVertical: 10 }} />

                <Text variant="bodySmall" style={{ fontWeight: 'bold', color: '#666', marginBottom: 5 }}>Productos Devueltos:</Text>
                <View style={{ backgroundColor: '#FAFAFA', borderRadius: 8, padding: 8 }}>
                  {item.items?.map((prod, idx) => (
                    <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={{ fontSize: 13, flex: 1, fontWeight: '500' }}>{prod.productName}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                        <Text style={{ fontSize: 11, color: '#F36F21', fontWeight: 'bold' }}>x{prod.quantity}</Text>
                        <Text style={{ fontSize: 10, color: '#999' }}>({prod.reason})</Text>
                      </View>
                    </View>
                  ))}
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 }}>
                  <Text variant="bodySmall" style={{ color: '#999' }}>Monto Est.: </Text>
                  <Text variant="bodySmall" style={{ fontWeight: 'bold' }}>
                    ${(item.items?.reduce((sum, i) => sum + (i.quantity * (i.price || 0)), 0) || 0).toLocaleString()}
                  </Text>
                </View>
              </Card.Content>
            </Card>
          ))}
        </ScrollView>
      ) : (
        // DESKTOP TABLE VIEW
        <View style={styles.tableContainer}>
          {/* Header */}
          <View style={styles.tableHeader}>
            <Text style={[styles.th, { flex: colWidths.id }]}>ID</Text>
            <Text style={[styles.th, { flex: colWidths.fecha }]}>Fecha</Text>
            <Text style={[styles.th, { flex: colWidths.origen }]}>Origen</Text>
            <Text style={[styles.th, { flex: colWidths.cliente }]}>Cliente</Text>
            <Text style={[styles.th, { flex: colWidths.items }]}>Items</Text>
            <Text style={[styles.th, { flex: colWidths.monto }]}>Monto</Text>
            <Text style={[styles.th, { flex: colWidths.estado }]}>Estado</Text>
          </View>

          {/* Rows */}
          <ScrollView>
            {filtered.map((item) => (
              <View key={item.id} style={styles.tableRow}>
                <Text style={[styles.td, { flex: colWidths.id }]}>{item.id.slice(-6)}</Text>
                <Text style={[styles.td, { flex: colWidths.fecha }]}>{item.jsDate.toLocaleDateString()}</Text>
                <View style={[styles.td, { flex: colWidths.origen, flexDirection: 'row', alignItems: 'center', gap: 5 }]}>
                  <MaterialCommunityIcons name={(item.origin || 'Móvil') === 'Móvil' ? "cellphone" : "monitor"} size={16} color="#666" />
                  <Text>{item.origin || 'Móvil'}</Text>
                </View>
                <View style={[styles.td, { flex: colWidths.cliente }]}>
                  <Text style={{ fontWeight: 'bold' }}>{item.client}</Text>
                  <Text style={{ fontSize: 10, color: '#666' }}>{item.docType} {item.invoice}</Text>
                </View>
                <View style={[styles.td, { flex: colWidths.items }]}>
                  {item.items?.map((prod, idx) => (
                    <Text key={idx} style={{ fontSize: 11 }}>
                      • {prod.productName} <Text style={{ fontWeight: 'bold', color: '#F36F21' }}>x{prod.quantity}</Text>
                    </Text>
                  ))}
                </View>
                <Text style={[styles.td, { flex: colWidths.monto }]}>
                  ${(item.items?.reduce((sum, i) => sum + (i.quantity * (i.price || 0)), 0) || 0).toLocaleString()}
                </Text>
                <View style={[styles.td, { flex: colWidths.estado }]}>
                  <Chip
                    style={{ backgroundColor: item.status === 'Aprobado' ? '#E8F5E9' : '#FFEBEE', height: 24 }}
                    textStyle={{ color: item.status === 'Aprobado' ? '#2E7D32' : '#C62828', fontSize: 10, fontWeight: 'bold', lineHeight: 12 }}
                  >
                    {item.status?.toUpperCase()}
                  </Chip>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* MODALS */}
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

export default function ReturnsScreen() {
  const [tab, setTab] = useState('new'); // 'new', 'list', 'history'

  return (
    <View style={styles.container}>
      <View style={styles.tabBar}>
        <TouchableOpacity onPress={() => setTab('new')} style={[styles.tabItem, tab === 'new' && styles.activeTab]}>
          <MaterialCommunityIcons name="plus-box" size={24} color={tab === 'new' ? '#F36F21' : '#666'} />
          <Text style={[styles.tabText, tab === 'new' && styles.activeTabText]}>Nueva</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setTab('list')} style={[styles.tabItem, tab === 'list' && styles.activeTab]}>
          <MaterialCommunityIcons name="clipboard-check" size={24} color={tab === 'list' ? '#F36F21' : '#666'} />
          <Text style={[styles.tabText, tab === 'list' && styles.activeTabText]}>Por Aprobar</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setTab('history')} style={[styles.tabItem, tab === 'history' && styles.activeTab]}>
          <MaterialCommunityIcons name="history" size={24} color={tab === 'history' ? '#F36F21' : '#666'} />
          <Text style={[styles.tabText, tab === 'history' && styles.activeTabText]}>Historial</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {tab === 'new' && <NewReturnForm onReturnCreated={() => setTab('list')} />}
        {tab === 'list' && <ReturnsList statusFilter="Pendiente" />}
        {tab === 'history' && <ReturnsHistory />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  tabBar: { flexDirection: 'row', backgroundColor: 'white', elevation: 2 },
  tabItem: { flex: 1, alignItems: 'center', padding: 15, borderBottomWidth: 3, borderBottomColor: 'transparent' },
  activeTab: { borderBottomColor: '#F36F21' },
  tabText: { marginTop: 5, color: '#666', fontSize: 12 },
  activeTabText: { color: '#F36F21', fontWeight: 'bold' },
  content: { flex: 1 },
  input: { marginBottom: 10, backgroundColor: 'white' },
  label: { marginBottom: 5, fontWeight: 'bold', color: '#555' },
  listContainer: { padding: 10 },
  card: { marginBottom: 10, backgroundColor: 'white', elevation: 2 },
  modal: { backgroundColor: 'white', padding: 20, margin: 20, borderRadius: 10 },
  filterContainer: { padding: 10, backgroundColor: 'white', elevation: 1 },
  filterContainerMobile: { flexDirection: 'column' },
  filterRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  mobileFilterInput: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#F5F5F5', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#E0E0E0'
  },
  desktopFilterInput: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'white',
    borderWidth: 1, borderColor: '#ccc', borderRadius: 5, paddingHorizontal: 10, height: 40
  },
  filterDropdown: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'white', borderWidth: 1, borderColor: '#ccc', borderRadius: 5, paddingHorizontal: 10, height: 40
  },
  tableContainer: { flex: 1, padding: 20 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#eee', padding: 10, borderRadius: 5, marginBottom: 5 },
  th: { fontWeight: 'bold', color: '#333' },
  tableRow: { flexDirection: 'row', backgroundColor: 'white', padding: 10, borderBottomWidth: 1, borderBottomColor: '#eee', alignItems: 'center' },
  td: { color: '#555', paddingRight: 10 },
});