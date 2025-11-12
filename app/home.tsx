// app/vote.tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
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
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

type Candidate = {
  id: string | number;
  name: string;
  dept: string;
  image?: string | null;
  position: string;
};

type CandidateGroup = {
  position: string;
  candidates: Candidate[];
};

type VotePayload = {
  position: string;
  candidateId: string | number;
};

const API_BASE = 'https://fue-vote-backend.onrender.com'; // <-- change if needed

const extractErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return fallback;
};

const getStoredToken = async (): Promise<string | null> => {
  try {
    const secureToken = await SecureStore.getItemAsync('jwt_token');
    if (secureToken) return secureToken;

    return await AsyncStorage.getItem('token');
  } catch (error) {
    console.warn('Failed to read stored token', error);
    return null;
  }
};

const authenticateWithBiometrics = async (promptMessage: string) => {
  const compatible = await LocalAuthentication.hasHardwareAsync();
  const enrolled = await LocalAuthentication.isEnrolledAsync();

  if (!compatible || !enrolled) {
    throw new Error('Fingerprint or Face ID not available on this device.');
  }

  const result = await LocalAuthentication.authenticateAsync({ promptMessage });

  if (!result.success) {
    throw new Error('Biometric verification was unsuccessful.');
  }
};

export default function VoteScreen() {
  const [candidatesData, setCandidatesData] = useState<CandidateGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedVotes, setSelectedVotes] = useState<Record<string, string | number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCheck, setShowCheck] = useState(false);
  const [overlayMessage, setOverlayMessage] = useState<string>('');
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [showSummary, setShowSummary] = useState(false);

  useEffect(() => {
    let mounted = true;

    const fetchCandidates = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/candidates`);
        if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);
        const data = await response.json();
        if (!Array.isArray(data)) {
          throw new Error('Unexpected response format.');
        }
        // Group by position
        const grouped = Object.values(
          data.reduce<Record<string, CandidateGroup>>((acc, candidate: Candidate) => {
            const position = candidate.position ?? 'Unknown Position';
            if (!acc[position]) {
              acc[position] = { position, candidates: [] };
            }
            acc[position].candidates.push(candidate);
            return acc;
          }, {})
        );
        if (mounted) {
          setCandidatesData(grouped);
          setCurrentIndex(0);
          setSelectedVotes({});
          setError(null);
        }
      } catch (err: any) {
        console.error(err);
        if (mounted) setError(err.message || 'Failed to load candidates');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchCandidates();
    return () => {
      mounted = false;
    };
  }, []);

  const totalCategories = candidatesData.length;
  const isLastCategory = currentIndex === totalCategories - 1;
  const currentCategory = candidatesData[currentIndex];
  const currentPosition = currentCategory?.position ?? '';

  // Helper to show check animation (returns a promise you can await)
  const showAnimatedCheck = useCallback(
    async (message: string, displayDuration = 1500) => {
      setOverlayMessage(message);
      return new Promise<void>((resolve) => {
        setShowCheck(true);
        Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start(() => {
          setTimeout(() => {
            Animated.timing(fadeAnim, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => {
              setShowCheck(false);
              setOverlayMessage('');
              resolve();
            });
          }, displayDuration);
        });
      });
    },
    [fadeAnim]
  );

  // Cast vote for a single category (requires biometric)
  const handleVote = useCallback(async () => {
    if (!currentCategory) return;

    const position = currentCategory.position;
    const selectedCandidateId = selectedVotes[position];

    if (!selectedCandidateId) {
      Alert.alert('No Selection', 'Please select a candidate before proceeding.');
      return;
    }

    try {
      await authenticateWithBiometrics('Authenticate to cast your vote');
      setIsSubmitting(true);

      const payload: VotePayload = { position, candidateId: selectedCandidateId };
      const token = await getStoredToken();

      const response = await fetch(`${API_BASE}/api/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(errText || 'Vote submission failed.');
      }

      await showAnimatedCheck('Vote Recorded!');

      if (!isLastCategory) {
        setCurrentIndex((prev) => prev + 1);
      } else {
        setShowSummary(true);
      }
    } catch (error) {
      console.error('Vote error:', error);
      Alert.alert('Vote Failed', extractErrorMessage(error, 'Unable to cast your vote. Try again.'));
    } finally {
      setIsSubmitting(false);
    }
  }, [currentCategory, isLastCategory, selectedVotes, showAnimatedCheck]);

  const handleSelect = useCallback(
    (id: string | number) => {
      if (!currentCategory) return;
      setSelectedVotes((prev) => ({
        ...prev,
        [currentCategory.position]: id,
      }));
    },
    [currentCategory]
  );

  // Final submission: biometrics + POST to /api/vote
  const handleFinalSubmit = useCallback(async () => {
    try {
      await authenticateWithBiometrics('Authenticate to submit your votes');

      const payload = Object.entries(selectedVotes).map(([position, candidateId]) => ({
        position,
        candidateId,
      }));

      if (payload.length === 0) {
        Alert.alert('No Votes', 'You have not selected any candidates.');
        return;
      }

      setIsSubmitting(true);

      const token = await getStoredToken();

      const response = await fetch(`${API_BASE}/api/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ votes: payload }),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => 'Unknown error');
        throw new Error(errText || 'Failed to submit votes');
      }

      await showAnimatedCheck('All Votes Submitted!', 1200);

      try {
        await AsyncStorage.clear();
        await SecureStore.deleteItemAsync('jwt_token');
      } catch (storageError) {
        console.warn('Failed to clear storage after submit', storageError);
      } finally {
        setSelectedVotes({});
        router.replace('/');
      }
    } catch (err) {
      console.error('Final submit error:', err);
      Alert.alert('Submission Failed', extractErrorMessage(err, 'Unable to submit votes. Try again.'));
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedVotes, showAnimatedCheck]);

  const renderCandidate = useCallback(
    ({ item }: { item: Candidate }) => {
      const selected = selectedVotes[currentPosition] === item.id;
      const imageSource = item.image ? { uri: item.image } : undefined;

      return (
        <TouchableOpacity
          activeOpacity={0.85}
          style={[styles.card, selected && styles.selectedCard]}
          onPress={() => handleSelect(item.id)}
          disabled={isSubmitting}
        >
          {imageSource ? (
            <Image source={imageSource} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Ionicons name="person-circle-outline" size={34} color="#99a1ad" />
            </View>
          )}
          <View style={styles.cardText}>
            <ThemedText style={styles.name}>{item.name}</ThemedText>
            <ThemedText style={styles.dept}>{item.dept}</ThemedText>
          </View>
          {selected && <Ionicons name="checkmark-circle" size={26} color="#00aa55" />}
        </TouchableOpacity>
      );
    },
    [currentPosition, handleSelect, isSubmitting, selectedVotes]
  );

  const keyExtractor = useCallback(
    (item: Candidate, index: number) => {
      if (item?.id !== undefined && item?.id !== null) {
        return String(item.id);
      }
      return `${currentPosition}-${index}`;
    },
    [currentPosition]
  );

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

  if (!currentCategory) {
    // Defensive: in case candidatesData is empty or index out of range
    return (
      <ThemedView style={styles.centered}>
        <ThemedText>No candidates available.</ThemedText>
      </ThemedView>
    );
  }

  if (showSummary) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText type="title" style={styles.header}>
          Voting Summary
        </ThemedText>
        <ScrollView showsVerticalScrollIndicator={false}>
          {candidatesData.map((category: any) => {
            const candidate = (category.candidates || []).find(
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
          style={[styles.voteButton, { backgroundColor: isSubmitting ? '#ccc' : '#00aa55' }]}
          onPress={handleFinalSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <View style={{ alignItems: 'center' }}>
              <ActivityIndicator size="small" color="#fff" />
              <ThemedText style={[styles.voteText, { marginTop: 6 }]}>Submitting votes...</ThemedText>
            </View>
          ) : (
            <ThemedText style={styles.voteText}>Submit Votes</ThemedText>
          )}
        </TouchableOpacity>

        {showCheck && (
          <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
            <Ionicons name="checkmark-circle" size={90} color="#00aa55" />
            <ThemedText style={styles.successText}>{overlayMessage}</ThemedText>
          </Animated.View>
        )}
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.header}>
        {currentCategory.position}
      </ThemedText>
      <View style={styles.progressContainer}>
        <ThemedText style={styles.progressText}>
          {currentIndex + 1} of {totalCategories} positions
        </ThemedText>
      </View>

      <FlatList
        data={currentCategory.candidates || []}
        keyExtractor={keyExtractor}
        renderItem={renderCandidate}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        ListEmptyComponent={
          <ThemedText style={styles.emptyState}>No candidates available for this position.</ThemedText>
        }
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
          <ThemedText style={styles.voteText}>{isLastCategory ? 'View Summary' : 'Cast Vote'}</ThemedText>
        )}
      </TouchableOpacity>

      {showCheck && (
        <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
          <Ionicons name="checkmark-circle" size={90} color="#00aa55" />
          <ThemedText style={styles.successText}>{overlayMessage}</ThemedText>
        </Animated.View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafc', padding: 20 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  progressContainer: { alignItems: 'center', marginBottom: 6 },
  progressText: { fontSize: 14, color: '#666' },
  header: {
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 10,
    marginTop: 46,
    color: '#1a1a1a',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    marginVertical: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  selectedCard: { borderWidth: 2, borderColor: '#00aa55', shadowColor: '#00aa55', shadowOpacity: 0.15 },
  avatar: { width: 54, height: 54, borderRadius: 27, marginRight: 14 },
  avatarPlaceholder: { backgroundColor: '#eef2f7', justifyContent: 'center', alignItems: 'center' },
  cardText: { flex: 1 },
  name: { fontSize: 17, fontWeight: '600', color: '#111' },
  dept: { fontSize: 14, color: '#666' },
  voteButton: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    backgroundColor: '#00aa55',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 3,
  },
  voteText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(249, 250, 252, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  successText: { marginTop: 12, fontSize: 20, fontWeight: '600', color: '#00aa55' },
  emptyState: { textAlign: 'center', marginTop: 24, color: '#666' },
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
});
