import React, { useState } from 'react';
import { View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { Provider as PaperProvider } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebaseConfig';

import { theme } from './src/theme/theme';

// COMPONENTES
import CustomDrawer from './src/components/CustomDrawer';
import { NotificationsProvider } from './src/context/NotificationsContext';

// PANTALLAS
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import ScannerScreen from './src/screens/ScannerScreen';
import InventoryScreen from './src/screens/InventoryScreen';
import ReturnsScreen from './src/screens/ReturnsScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import WasteScreen from './src/screens/WasteScreen';
import ProfileScreen from './src/screens/ProfileScreen';

const Tab = createBottomTabNavigator();
const Drawer = createDrawerNavigator();

// --- NAVEGADOR DE PESTAÑAS INFERIOR ---
function BottomTabNavigator() {
    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                headerShown: false,
                tabBarActiveTintColor: theme.colors.primary,
                tabBarInactiveTintColor: 'gray',
                tabBarStyle: { paddingBottom: 5, height: 60, borderTopWidth: 0, elevation: 5 },
                tabBarIcon: ({ color, size, focused }) => {
                    let iconName = 'circle';
                    if (route.name === 'Inicio') iconName = focused ? 'home' : 'home-outline';
                    if (route.name === 'Ingreso') iconName = 'barcode-scan';
                    if (route.name === 'Stock') iconName = focused ? 'package-variant' : 'package-variant-closed';
                    return <MaterialCommunityIcons name={iconName} size={26} color={color} />;
                },
            })}
        >
            <Tab.Screen name="Inicio" component={HomeScreen} />
            <Tab.Screen name="Ingreso" component={ScannerScreen} />
            <Tab.Screen name="Stock" component={InventoryScreen} />
        </Tab.Navigator>
    );
}

// --- NAVEGADOR LATERAL (Drawer) ---
function DrawerNavigator() {
    return (
        <Drawer.Navigator
            drawerContent={props => <CustomDrawer {...props} />}
            screenOptions={{
                headerStyle: { backgroundColor: theme.colors.primary, elevation: 0 },
                headerTintColor: '#fff',
                headerTitleStyle: { fontWeight: 'bold' },
                drawerActiveBackgroundColor: theme.colors.primary + '20',
                drawerActiveTintColor: theme.colors.primary,
                drawerLabelStyle: { marginLeft: 5, fontWeight: 'bold' },
            }}
        >
            <Drawer.Screen
                name="Panel Principal"
                component={BottomTabNavigator}
                options={{
                    title: 'Inicio / Dashboard',
                    drawerIcon: ({ color }) => <MaterialCommunityIcons name="view-dashboard-outline" size={22} color={color} />,
                    headerShown: false
                }}
            />

            <Drawer.Screen
                name="Inventario"
                component={InventoryScreen}
                listeners={({ navigation }) => ({
                    drawerItemPress: (e) => {
                        e.preventDefault();
                        navigation.navigate('Panel Principal', { screen: 'Stock' });
                    },
                })}
                options={{
                    drawerIcon: ({ color }) => <MaterialCommunityIcons name="clipboard-list-outline" size={22} color={color} />,
                    headerShown: false
                }}
            />

            <Drawer.Screen
                name="Devoluciones"
                component={ReturnsScreen}
                options={{ drawerIcon: ({ color }) => <MaterialCommunityIcons name="truck-delivery-outline" size={22} color={color} /> }}
            />
            <Drawer.Screen
                name="Mermas"
                component={WasteScreen}
                options={{ title: 'Registro de Mermas', drawerIcon: ({ color }) => <MaterialCommunityIcons name="trash-can-outline" size={22} color={color} /> }}
            />
            <Drawer.Screen
                name="Alertas"
                component={NotificationsScreen}
                options={{ drawerIcon: ({ color }) => <MaterialCommunityIcons name="bell-outline" size={22} color={color} /> }}
            />

            <Drawer.Screen
                name="Perfil"
                component={ProfileScreen}
                options={{ drawerIcon: ({ color }) => <MaterialCommunityIcons name="account-circle-outline" size={22} color={color} /> }}
            />
        </Drawer.Navigator>
    );
}

export default function App() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    React.useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (u) => {
            setUser(u);
            setLoading(false);
        });
        return unsubscribe;
    }, []);

    if (loading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <MaterialCommunityIcons name="loading" size={50} color={theme.colors.primary} />
            </View>
        );
    }

    if (!user) {
        return (
            <PaperProvider theme={theme}>
                <LoginScreen onLogin={() => { }} />
            </PaperProvider>
        );
    }

    return (
        <PaperProvider theme={theme}>
            <NotificationsProvider>
                <NavigationContainer>
                    <DrawerNavigator />
                </NavigationContainer>
            </NotificationsProvider>
        </PaperProvider>
    );
}