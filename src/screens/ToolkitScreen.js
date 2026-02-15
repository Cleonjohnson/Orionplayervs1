import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

export default function ToolkitScreen({ navigation }) {
  const tools = [
    { id: '1', name: 'Charades', icon: 'bulb-outline', screen: 'CharadesMenu' },
    { id: '2', name: 'King Tuffhead', icon: 'game-controller-outline', screen: 'KingTuffheadGame' },
    { id: '3', name: 'Yardie Hustle', icon: 'cash-outline', screen: 'YardieHustle' },
    { id: '4', name: 'Politricks', icon: 'megaphone-outline', screen: 'Politricks' },
    { id: '5', name: 'Soft Skills', icon: 'people-outline', screen: 'SoftSkills' },
    { id: '6', name: 'Border Control', icon: 'flag-outline', screen: 'BorderControl' },
  ];

  const handleToolPress = (screen) => {
    navigation.navigate(screen);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Orion Toolkit</Text>
      <ScrollView contentContainerStyle={styles.toolsGrid}>
        {tools.map((tool) => (
          <TouchableOpacity key={tool.id} style={styles.toolCard} onPress={() => handleToolPress(tool.screen)}>
            <Ionicons name={tool.icon} size={40} color="#FFD700" />
            <Text style={styles.toolName}>{tool.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: "#FFD700",
    marginBottom: 20,
    textAlign: 'center',
  },
  toolsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
  },
  toolCard: {
    width: '45%', // Approx. two cards per row with some spacing
    backgroundColor: "#1E1E1E",
    borderRadius: 15,
    padding: 20,
    marginVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 2,
    elevation: 5,
    minHeight: 150,
    borderColor: "#FFD700",
    borderWidth: 1,
  },
  toolName: {
    marginTop: 10,
    fontSize: 18,
    fontWeight: '600',
    color: "#FFFFFF",
    textAlign: 'center',
  },
});