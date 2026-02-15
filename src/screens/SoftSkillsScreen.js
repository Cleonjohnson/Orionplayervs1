import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function SoftSkillsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Soft Skills Module Loading...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
    padding: 20,
  },
  text: {
    color: "#FFFFFF",
  },
});
