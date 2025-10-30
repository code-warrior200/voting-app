// app/vote.tsx
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  Animated,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication'; // ✅ biometric import

export default function VoteScreen() {
  const [candidatesData, setCandidatesData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedVotes, setSelectedVotes] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCheck, setShowCheck] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [showSummary, setShowSummary] = useState(false);

  useEffect(() => {
    const fetchCandidates = async () => {
      try {
        const response = await fetch('https://fue-vote-backend-1.onrender.com/api/candidates');
        if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);
        const data = await response.json();

        const grouped = Object.values(
          data.reduce((acc: any, candidate: any) => {
            if (!acc[candidate.position]) {
              acc[candidate.position] = { position: candidate.position, candidates: [] };
            }
            acc[candidate.position].candidates.push(candidate);
            return acc;
          }, {})
        );
        setCandidatesData(grouped);
      } catch (err: any) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchCandidates();
  }, []);

  const totalCategories = candidatesData.length;
  const isLastCategory = currentIndex === totalCategories - 1;
  const currentCategory = candidatesData[currentIndex];

  if (loading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator size="large" color="#00aa55" />
        <ThemedText style={{ marginTop: 10 }}>Loading candidates...</ThemedText>
      </ThemedView>
    );
  }

  if (error) {
    return (
      <ThemedView style={styles.centered}>
        <Ionicons name="alert-circle" size={50} color="red" />
        <ThemedText style={{ marginTop: 10, color: 'red' }}>
          Failed to load candidates: {error}
        </ThemedText>
      </ThemedView>
    );
  }

  if (candidatesData.length === 0) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText>No candidates found.</ThemedText>
      </ThemedView>
    );
  }

  // ✅ Require biometric auth before casting vote
  const handleVote = async () => {
    if (!selectedVotes[currentCategory.position]) return;

    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();

      if (!compatible || !enrolled) {
        Alert.alert(
          'Biometric Unavailable',
          'Fingerprint or Face ID not available on this device.'
        );
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to cast your vote',
      });

      if (!result.success) {
        Alert.alert('Authentication Failed', 'Biometric verification was unsuccessful.');
        return;
      }

      // ✅ Proceed after successful biometric auth
      setIsSubmitting(true);
      setTimeout(() => {
        setIsSubmitting(false);
        setShowCheck(true);
        Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start(() => {
          setTimeout(() => {
            Animated.timing(fadeAnim, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => {
              setShowCheck(false);
              if (!isLastCategory) setCurrentIndex((prev) => prev + 1);
              else setShowSummary(true);
            });
          }, 1500);
        });
      }, 1000);
    } catch (error: any) {
      console.error('Biometric error:', error);
      Alert.alert('Error', error.message || 'Unable to authenticate. Try again.');
    }
  };

  const handleLogout = async () => {
    try {
      await AsyncStorage.clear();
      setSelectedVotes({});
      setShowCheck(false);
      router.replace('/');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const handleSelect = (id: string) => {
    setSelectedVotes((prev) => ({
      ...prev,
      [currentCategory.position]: id,
    }));
  };

  // ✅ Final submission also requires biometric authentication
  const handleFinalSubmit = async () => {
    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();

      if (!compatible || !enrolled) {
        Alert.alert(
          'Biometric Unavailable',
          'Fingerprint or Face ID not available on this device.'
        );
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to submit your votes',
      });

      if (!result.success) {
        Alert.alert('Authentication Failed', 'Biometric verification was unsuccessful.');
        return;
      }

      // ✅ Proceed to submit votes after successful biometric auth
      setIsSubmitting(true);
      setTimeout(() => {
        setShowCheck(true);
        Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
        setIsSubmitting(false);
      }, 1500);
    } catch (error: any) {
      console.error('Final biometric error:', error);
      Alert.alert('Error', error.message || 'Unable to authenticate. Try again.');
    }
  };

  if (showSummary) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText type="title" style={styles.header}>Voting Summary</ThemedText>
        <ScrollView showsVerticalScrollIndicator={false}>
          {candidatesData.map((category) => {
            const candidate = category.candidates.find(
              (c: any) => c.id === selectedVotes[category.position]
            );
            return (
              <View key={category.position} style={styles.summaryCard}>
                <ThemedText style={styles.positionText}>{category.position}</ThemedText>
                {candidate ? (
                  <View style={styles.summaryRow}>
                    <Image source={{ uri: candidate.image }} style={styles.summaryAvatar} />
                    <View style={{ flex: 1 }}>
                      <ThemedText style={styles.name}>{candidate.name}</ThemedText>
                      <ThemedText style={styles.dept}>{candidate.dept}</ThemedText>
                    </View>
                  </View>
                ) : (
                  <ThemedText style={{ color: '#999', marginTop: 8 }}>No candidate selected</ThemedText>
                )}
              </View>
            );
          })}
        </ScrollView>

        <TouchableOpacity
          style={[styles.voteButton, { backgroundColor: '#00aa55' }]}
          onPress={handleFinalSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <ThemedText style={styles.voteText}>Submit All Votes</ThemedText>
          )}
        </TouchableOpacity>

        {showCheck && (
          <Animated.View style={[styles.overlay, { opacity: fadeAnim }]} >
            <Ionicons name="checkmark-circle" size={90} color="#00aa55" />
            <ThemedText style={styles.successText}>All Votes Submitted!</ThemedText>
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={20} color="#fff" style={{ marginRight: 6 }} />
              <ThemedText style={styles.logoutText}>Logout</ThemedText>
            </TouchableOpacity>
          </Animated.View>
        )}
      </ThemedView>
    );
  }

  const renderCandidate = ({ item }: { item: any }) => {
    const selected = selectedVotes[currentCategory.position] === item.id;
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        style={[styles.card, selected && styles.selectedCard]}
        onPress={() => handleSelect(item.id)}
        disabled={isSubmitting}
      >
        <Image source={{ uri: item.image }} style={styles.avatar} />
        <View style={styles.cardText}>
          <ThemedText style={styles.name}>{item.name}</ThemedText>
          <ThemedText style={styles.dept}>{item.dept}</ThemedText>
        </View>
        {selected && <Ionicons name="checkmark-circle" size={26} color="#00aa55" />}
      </TouchableOpacity>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.header}>{currentCategory.position}</ThemedText>
      <View style={styles.progressContainer}>
        <ThemedText style={styles.progressText}>
          {currentIndex + 1} of {totalCategories} positions
        </ThemedText>
      </View>
      <FlatList
        data={currentCategory.candidates}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderCandidate}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      />

      <TouchableOpacity
        style={[
          styles.voteButton,
          (!selectedVotes[currentCategory.position] || isSubmitting) && { backgroundColor: '#ccc' },
        ]}
        disabled={!selectedVotes[currentCategory.position] || isSubmitting}
        onPress={handleVote}
      >
        {isSubmitting ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <ThemedText style={styles.voteText}>
            {isLastCategory ? 'View Summary' : 'Cast Vote'}
          </ThemedText>
        )}
      </TouchableOpacity>

      {showCheck && (
        <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
          <Ionicons name="checkmark-circle" size={90} color="#00aa55" />
          <ThemedText style={styles.successText}>Vote Recorded!</ThemedText>
        </Animated.View>
      )}
    </ThemedView>
  );
}

// 🧩 Styles (same)
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafc', padding: 20 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  progressContainer: { alignItems: 'center', marginBottom: 6 },
  progressText: { fontSize: 14, color: '#666' },
  header: {
    textAlign: 'center', fontSize: 24, fontWeight: '700',
    marginBottom: 10, marginTop: 46, color: '#1a1a1a'
  },
  card: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 16, padding: 14, marginVertical: 8, elevation: 2,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4,
  },
  selectedCard: { borderWidth: 2, borderColor: '#00aa55', shadowColor: '#00aa55', shadowOpacity: 0.15 },
  avatar: { width: 54, height: 54, borderRadius: 27, marginRight: 14 },
  cardText: { flex: 1 },
  name: { fontSize: 17, fontWeight: '600', color: '#111' },
  dept: { fontSize: 14, color: '#666' },
  voteButton: {
    position: 'absolute', bottom: 30, left: 20, right: 20,
    backgroundColor: '#00aa55', paddingVertical: 16, borderRadius: 12,
    alignItems: 'center', elevation: 3,
  },
  voteText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(249, 250, 252, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  successText: { marginTop: 12, fontSize: 20, fontWeight: '600', color: '#00aa55' },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginVertical: 8,
    elevation: 1,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  positionText: { fontSize: 16, fontWeight: '700', color: '#00aa55' },
  summaryAvatar: { width: 50, height: 50, borderRadius: 25, marginRight: 12 },
  logoutButton: {
    flexDirection: 'row',
    backgroundColor: '#00aa55',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    marginTop: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
