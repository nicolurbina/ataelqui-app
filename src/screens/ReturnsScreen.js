import React, { useState, useEffect } from 'react';
import { View, ScrollView, Image, Alert, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Text, TextInput, Button, Card, Chip, Searchbar, Modal, Portal, RadioButton, IconButton } from 'react-native-paper';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker'; 
import { db } from '../../firebaseConfig';
import { collection, addDoc, onSnapshot, query, where, orderBy, doc, updateDoc } from 'firebase/firestore';

// --- PESTAÑA 1: NUEVA DEVOLUCIÓN ---
function NewReturnForm() {
  const [photo, setPhoto] = useState(null);
  const [invoice, setInvoice] = useState('');
  const [reason, setReason] = useState('');
  const [truck, setTruck] = useState('');
  const [client, setClient] = useState('');
  const [loading, setLoading] = useState(false);

  const takePhoto = async () => {
    let result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.5 });
    if (!result.canceled) setPhoto(result.assets[0].uri);
  };

  const handleSubmit = async () => {
    if (!invoice || !truck) return Alert.alert("Faltan Datos");
    setLoading(true);
    try {
      await addDoc(collection(db, "returns"), {
        invoice, reason, truck, client, photoURI: photo || null, status: 'Pendiente', date: new Date(), origin: 'Móvil'
      });
      Alert.alert("Registrado");
      setInvoice(''); setReason(''); setTruck(''); setClient(''); setPhoto(null);
    } catch (e) { Alert.alert("Error", e.message); } finally { setLoading(false); }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <Text variant="titleMedium" style={{color:'#F36F21', fontWeight:'bold'}}>Nueva Devolución</Text>
      <TextInput label="Camión" value={truck} onChangeText={setTruck} mode="outlined" style={styles.input} />
      <TextInput label="Cliente" value={client} onChangeText={setClient} mode="outlined" style={styles.input} />
      <TextInput label="Factura" value={invoice} onChangeText={setInvoice} mode="outlined" style={styles.input} />
      <TextInput label="Motivo" value={reason} onChangeText={setReason} mode="outlined" style={styles.input} />
      <Button icon="camera" mode="outlined" onPress={takePhoto} style={{marginBottom:10}}>{photo ? "Foto OK" : "Foto Evidencia"}</Button>
      <Button mode="contained" onPress={handleSubmit} loading={loading} buttonColor="#F36F21">Enviar</Button>
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
        <Text variant="headlineSmall" style={{marginBottom:15}}>Editar</Text>
        <TextInput label="Camión" value={editTruck} onChangeText={setEditTruck} mode="outlined" style={styles.input} />
        <RadioButton.Group onValueChange={setEditStatus} value={editStatus}>
            <View style={{flexDirection:'row', flexWrap:'wrap'}}>
                <View style={{flexDirection:'row', alignItems:'center', marginRight:10}}><RadioButton value="Pendiente" /><Text>Pendiente</Text></View>
                <View style={{flexDirection:'row', alignItems:'center', marginRight:10}}><RadioButton value="Aprobado" /><Text>Aprobado</Text></View>
                <View style={{flexDirection:'row', alignItems:'center'}}><RadioButton value="Rechazado" /><Text>Rechazado</Text></View>
            </View>
        </RadioButton.Group>
        <Button mode="contained" onPress={handleUpdate} buttonColor="#F36F21" style={{marginTop:20}}>Guardar</Button>
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
    <View style={{flex:1}}>
        <ScrollView style={styles.listContainer}>
        {list.map((item) => (
            <Card key={item.id} style={styles.card}>
            <Card.Title title={item.truck} subtitle={item.invoice} right={(props) => <Chip {...props} style={{marginRight:10}}>{item.status}</Chip>} />
            <Card.Content><Text>Cliente: {item.client}</Text></Card.Content>
            
            {/* CORRECCIÓN AQUÍ: Quitamos los fragmentos <> </> */}
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
    <View style={{flex:1, backgroundColor:'#f0f0f0'}}>
        <View style={{backgroundColor:'white', padding:10}}>
            <Searchbar placeholder="Buscar Cliente, Factura..." onChangeText={setSearch} value={search} style={{marginBottom:10, backgroundColor:'#f0f0f0'}}/>
            <View style={{flexDirection:'row', alignItems:'center'}}>
                <Button mode="outlined" icon="calendar" onPress={() => setShowPicker(true)} style={{flex:1, marginRight:10}}>
                    {selectedDate ? selectedDate.toLocaleDateString() : "Filtrar por Fecha"}
                </Button>
                {selectedDate && <IconButton icon="close-circle" size={24} onPress={() => setSelectedDate(null)} />}
            </View>
            {showPicker && <DateTimePicker value={selectedDate || new Date()} mode="date" display="default" onChange={onDateChange} />}
        </View>

        <ScrollView style={styles.listContainer}>
             {filtered.length === 0 && <Text style={{textAlign:'center', marginTop:20, color:'#999'}}>No se encontraron resultados.</Text>}
             {filtered.map((item) => (
                <Card key={item.id} style={styles.card}>
                    <Card.Title 
                        title={item.client || "Sin Cliente"} 
                        subtitle={item.jsDate.toLocaleDateString()} 
                        right={(props) => (
                            <Text {...props} style={{color: item.status === 'Aprobado' ? 'green' : 'red', fontWeight:'bold', marginRight:15}}>
                                {item.status?.toUpperCase()}
                            </Text>
                        )} 
                    />
                    <Card.Content>
                        <Text style={{fontWeight:'bold'}}>Factura: {item.invoice}</Text>
                        <Text variant="bodySmall" style={{color:'#666'}}>Camión: {item.truck} | Motivo: {item.reason}</Text>
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
  scrollContainer: { padding: 20, backgroundColor: '#fff', flexGrow:1 },
  listContainer: { flex: 1, padding: 10 },
  input: { marginBottom: 12, backgroundColor: 'white' },
  card: { marginBottom: 10, backgroundColor: 'white' },
  modal: { backgroundColor: 'white', padding: 20, margin: 20, borderRadius: 10 }
});