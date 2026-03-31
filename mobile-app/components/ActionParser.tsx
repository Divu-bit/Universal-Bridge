import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import axios from 'axios';

export default function ActionParser({ schema, onActionCompleted }: { schema: any[]; onActionCompleted?: () => void }) {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [activeButton, setActiveButton] = useState<string | null>(null);

  if (!schema || !Array.isArray(schema)) {
     return <Text style={styles.noSchema}>No interactive schema found.</Text>;
  }

  const handleChange = (id: string, value: string) => {
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  const handleAction = async (actionDef: any) => {
    if (!actionDef.webhookUrl) return;
    setLoading(true);
    setActiveButton(actionDef.action);
    try {
      await axios.post(actionDef.webhookUrl, {
        action: actionDef.action,
        data: formData
      });
      alert('Action Successful!');
      if (onActionCompleted) onActionCompleted();
    } catch (err: any) {
      console.error('Webhook failed:', err.message, err.response?.data);
      alert('Failed: ' + err.message);
    } finally {
      setLoading(false);
      setActiveButton(null);
    }
  };

  // Determine button color based on action keywords
  const getButtonStyle = (item: any) => {
    const label = (item.label || '').toLowerCase();
    const action = (item.action || '').toLowerCase();
    
    if (action.includes('deny') || action.includes('reject') || action.includes('cancel') || label.includes('deny') || label.includes('❌')) {
      return {
        bg: 'rgba(239, 68, 68, 0.12)',
        border: 'rgba(239, 68, 68, 0.3)',
        text: '#EF4444',
        activeBg: 'rgba(239, 68, 68, 0.25)',
      };
    }
    return {
      bg: 'rgba(108, 92, 231, 0.12)',
      border: 'rgba(108, 92, 231, 0.35)',
      text: '#A78BFA',
      activeBg: 'rgba(108, 92, 231, 0.3)',
    };
  };

  return (
    <View style={styles.container}>
      {schema.map((item, index) => {
        if (item.type === 'display_text') {
          return (
            <View key={index} style={styles.displayCard}>
              <Text style={styles.displayText}>{item.label}</Text>
            </View>
          );
        }

        if (item.type === 'text_input') {
          return (
            <View key={index} style={styles.inputContainer}>
              <Text style={styles.inputLabel}>{item.label}</Text>
              <TextInput
                style={styles.input}
                placeholder={item.label}
                placeholderTextColor="#4A4A6A"
                value={formData[item.id] || ''}
                onChangeText={(text) => handleChange(item.id, text)}
                selectionColor="#6C5CE7"
              />
            </View>
          );
        }

        if (item.type === 'button') {
          const btnStyle = getButtonStyle(item);
          const isActive = loading && activeButton === item.action;

          return (
            <TouchableOpacity
              key={index}
              style={[
                styles.button,
                {
                  backgroundColor: isActive ? btnStyle.activeBg : btnStyle.bg,
                  borderColor: btnStyle.border,
                },
              ]}
              onPress={() => handleAction(item)}
              disabled={loading}
              activeOpacity={0.7}
            >
              {isActive ? (
                <ActivityIndicator size="small" color={btnStyle.text} />
              ) : (
                <Text style={[styles.buttonText, { color: btnStyle.text }]}>
                  {item.label}
                </Text>
              )}
            </TouchableOpacity>
          );
        }

        return null;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  noSchema: {
    color: '#5A5A7A',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 20,
  },
  displayCard: {
    backgroundColor: 'rgba(108, 92, 231, 0.06)',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#6C5CE7',
  },
  displayText: {
    fontSize: 15,
    color: '#C8C8E0',
    lineHeight: 22,
    fontWeight: '500',
  },
  inputContainer: {
    marginTop: 4,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8B8FA3',
    marginBottom: 8,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: '#12121F',
    borderWidth: 1.5,
    borderColor: '#2A2A45',
    borderRadius: 12,
    padding: 14,
    paddingHorizontal: 16,
    fontSize: 15,
    color: '#E0E0F0',
    fontFamily: Platform.OS === 'ios' ? 'system' : 'normal',
  },
  button: {
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    minHeight: 54,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
