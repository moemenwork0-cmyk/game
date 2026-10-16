import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Platform } from 'react-native';

const OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  quality: 0.7,
  allowsEditing: false,
};

/** Opens the camera or the photo library and returns a URI the app owns. */
export async function pickPhoto(source: 'camera' | 'library'): Promise<string | undefined> {
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Camera access needed', 'Allow camera access in Settings to snap a photo.');
      return undefined;
    }
  }
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(OPTIONS)
      : await ImagePicker.launchImageLibraryAsync(OPTIONS);
  if (result.canceled || !result.assets?.[0]) return undefined;
  return keep(result.assets[0].uri);
}

/** Picker results live in a cache that the OS may clear, so copy them into documents. */
async function keep(uri: string): Promise<string> {
  if (Platform.OS === 'web') return uri;
  try {
    const dir = new Directory(Paths.document, 'photos');
    if (!dir.exists) dir.create({ intermediates: true });
    const ext = uri.split('.').pop()?.split('?')[0] || 'jpg';
    const dest = new File(dir, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`);
    await new File(uri).copy(dest);
    return dest.uri;
  } catch {
    return uri;
  }
}

export function deletePhoto(uri?: string) {
  if (!uri || Platform.OS === 'web' || !uri.includes('/photos/')) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Best effort; a stray photo is harmless.
  }
}
