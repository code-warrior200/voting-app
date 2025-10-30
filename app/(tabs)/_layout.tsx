/* eslint-disable @typescript-eslint/no-unused-vars */
import React from 'react';
import { Stack } from 'expo-router';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function RootLayout() {
  // You can still detect color scheme if needed
  const colorScheme = useColorScheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: '#ffffff', // ✅ Set background to pure white
        },
      }}
    >
      {/* Define screens in the navigation flow */}
      <Stack.Screen name="index" /> {/* Login Screen */}
      <Stack.Screen name="home" />  {/* Election Dashboard */}
      <Stack.Screen name="vote" />  {/* Voting Screen */}
    </Stack>
  );
}
