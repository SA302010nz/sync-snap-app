import 'react-native-get-random-values';
import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import axios from 'axios';
import { StatusBar } from 'expo-status-bar';

WebBrowser.maybeCompleteAuthSession();

// Placeholder for Google Client ID
// For development, you can get one from Google Cloud Console
const GOOGLE_CLIENT_ID = '1075538033327-t9f0aa8e1tdsh61kqsllb6bmpn8d4bjq.apps.googleusercontent.com';

export default function App() {
  const [accessToken, setAccessToken] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = React.useRef(null);

  // Google Login Request
  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: GOOGLE_CLIENT_ID,
      scopes: ['https://www.googleapis.com/auth/drive.file'],
      redirectUri: AuthSession.makeRedirectUri({
        scheme: 'syncsnaptext',
      }),
    },
    { authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth' }
  );

  useEffect(() => {
    if (response?.type === 'success') {
      const { authentication } = response;
      setAccessToken(authentication.accessToken);
      Alert.alert('Logged In', 'Successfully connected to Google Drive');
    }
  }, [response]);

  const handlePasteAndSync = async () => {
    if (!accessToken) {
      Alert.alert('Auth Required', 'Please login to Google Drive first.');
      return;
    }

    try {
      setLoading(true);
      const text = await Clipboard.getStringAsync();
      if (!text) {
        Alert.alert('Clipboard Empty', 'No text found in clipboard.');
        setLoading(false);
        return;
      }

      // Upload text to Google Drive using multipart upload
      const metadata = {
        name: `SyncSnap_Text_${new Date().toISOString().replace(/[:.]/g, '-')}.txt`,
        mimeType: 'text/plain',
      };

      const boundary = 'foo_bar_baz';
      const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(
        metadata
      )}\r\n--${boundary}\r\nContent-Type: text/plain\r\n\r\n${text}\r\n--${boundary}--`;

      await axios.post(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
        body,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': `multipart/related; boundary=${boundary}`,
          },
        }
      );

      Alert.alert('Success', 'Text uploaded to Google Drive!');
    } catch (error) {
      console.error(error);
      Alert.alert('Upload Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSnapAndSync = async () => {
    if (!accessToken) {
      Alert.alert('Auth Required', 'Please login to Google Drive first.');
      return;
    }

    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (!granted) {
        Alert.alert('Permission Denied', 'Camera permission is required.');
        return;
      }
    }
    setShowCamera(true);
  };

  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        setLoading(true);
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.7,
          base64: true,
        });
        setShowCamera(false);

        // Upload photo to Google Drive
        const metadata = {
          name: `SyncSnap_Photo_${new Date().toISOString()}.jpg`,
          mimeType: 'image/jpeg',
        };

        // For large binary files in RN, we use direct upload or multipart
        // For simplicity in this demo, we'll use base64 conversion or binary
        const fileContent = photo.base64;

        // Multipart upload for photo
        const boundary = 'foo_bar_baz';
        const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(
          metadata
        )}\r\n--${boundary}\r\nContent-Type: image/jpeg\r\nContent-Transfer-Encoding: base64\r\n\r\n${fileContent}\r\n--${boundary}--`;

        await axios.post(
          'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
          body,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': `multipart/related; boundary=${boundary}`,
            },
          }
        );

        Alert.alert('Success', 'Photo uploaded to Google Drive!');
      } catch (error) {
        console.error(error);
        Alert.alert('Upload Failed', error.message);
      } finally {
        setLoading(false);
      }
    }
  };

  if (showCamera) {
    return (
      <View style={styles.container}>
        <CameraView style={styles.camera} ref={cameraRef}>
          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.captureButton} onPress={takePicture}>
              <Text style={styles.text}>SNAP</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowCamera(false)}
            >
              <Text style={styles.text}>CANCEL</Text>
            </TouchableOpacity>
          </View>
        </CameraView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      <Text style={styles.title}>SyncSnap & Text</Text>
      
      {!accessToken ? (
        <TouchableOpacity
          disabled={!request}
          style={styles.loginButton}
          onPress={() => promptAsync()}
        >
          <Text style={styles.buttonText}>Login with Google</Text>
        </TouchableOpacity>
      ) : (
        <Text style={styles.status}>Connected to Google Drive</Text>
      )}

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.mainButton, { backgroundColor: '#4CAF50' }]}
          onPress={handlePasteAndSync}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.mainButtonText}>Paste & Sync</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.mainButton, { backgroundColor: '#2196F3' }]}
          onPress={handleSnapAndSync}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.mainButtonText}>Snap & Sync</Text>
          )}
        </TouchableOpacity>
      </View>

      <Text style={styles.footer}>Ready for APK Build</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 40,
    color: '#333',
  },
  loginButton: {
    backgroundColor: '#db4437',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
    marginBottom: 30,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  status: {
    color: '#4CAF50',
    fontWeight: '600',
    marginBottom: 30,
  },
  buttonRow: {
    width: '100%',
    gap: 20,
  },
  mainButton: {
    height: 120,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  mainButtonText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
  },
  camera: {
    flex: 1,
    width: '100%',
  },
  buttonContainer: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'transparent',
    margin: 64,
  },
  captureButton: {
    flex: 1,
    alignSelf: 'flex-end',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginRight: 10,
  },
  cancelButton: {
    flex: 1,
    alignSelf: 'flex-end',
    alignItems: 'center',
    backgroundColor: '#ff5252',
    padding: 15,
    borderRadius: 10,
  },
  text: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  footer: {
    marginTop: 50,
    color: '#888',
    fontSize: 12,
  },
});
