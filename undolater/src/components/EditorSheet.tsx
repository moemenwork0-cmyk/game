import { Feather } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { TextInputInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { deletePhoto, pickPhoto } from '../photos';
import { radius, usePalette } from '../theme';
import type { Draft, UndoItem } from '../types';
import { ReminderPicker, defaultChoice } from './ReminderPicker';
import type { ReminderChoice } from './ReminderPicker';
import { Sheet } from './Sheet';
import { SectionLabel } from './ui';

type Props = {
  visible: boolean;
  /** The item being edited, or undefined for a new one. Remount (via `key`) for each open. */
  item?: UndoItem;
  onClose: () => void;
  onSave: (draft: Draft) => void;
};

export function EditorSheet({ visible, item, onClose, onSave }: Props) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState(item?.title ?? '');
  const [note, setNote] = useState(item?.note ?? '');
  const [photoUri, setPhotoUri] = useState(item?.photoUri);
  const [reminder, setReminder] = useState<ReminderChoice>(() =>
    item
      ? item.remindAt && item.remindAt > Date.now()
        ? { key: 'custom', date: new Date(item.remindAt) }
        : { key: 'none' }
      : defaultChoice(),
  );
  const titleRef = useRef<TextInputInstance>(null);

  // New items: jump straight into typing once the sheet is up.
  useEffect(() => {
    if (!visible || item) return;
    const t = setTimeout(() => titleRef.current?.focus(), Platform.OS === 'android' ? 350 : 50);
    return () => clearTimeout(t);
  }, [visible, item]);

  // Photos taken in this session but not kept are cleaned up.
  const discardPhoto = (uri?: string) => {
    if (uri && uri !== item?.photoUri) deletePhoto(uri);
  };

  const cancel = () => {
    discardPhoto(photoUri);
    onClose();
  };

  const canSave = title.trim().length > 0;
  const save = () => {
    if (!canSave) return;
    onSave({
      title: title.trim(),
      note: note.trim() || undefined,
      photoUri,
      remindAt: reminder.key === 'none' ? undefined : reminder.date?.getTime(),
    });
  };

  const addPhoto = async (source: 'camera' | 'library') => {
    const uri = await pickPhoto(source);
    if (!uri) return;
    discardPhoto(photoUri);
    setPhotoUri(uri);
  };

  return (
    <Sheet
      visible={visible}
      onClose={cancel}
      title={item ? 'Edit change' : 'New change'}
      left={
        <Pressable onPress={cancel} hitSlop={10}>
          <Text style={[styles.headerBtn, { color: p.muted }]}>Cancel</Text>
        </Pressable>
      }
      right={
        <Pressable
          onPress={save}
          disabled={!canSave}
          hitSlop={10}
          style={[styles.save, { backgroundColor: canSave ? p.ink : p.surfaceAlt }]}>
          <Text style={[styles.saveText, { color: canSave ? p.onInk : p.faint }]}>Save</Text>
        </Pressable>
      }>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 32 }]}>
        <TextInput
          ref={titleRef}
          value={title}
          onChangeText={setTitle}
          placeholder="What did you change?"
          placeholderTextColor={p.faint}
          multiline
          maxLength={140}
          style={[styles.titleInput, styles.webInput, { color: p.text }]}
          submitBehavior="blurAndSubmit"
          returnKeyType="done"
        />
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="How to put it back (optional)"
          placeholderTextColor={p.faint}
          multiline
          maxLength={400}
          style={[styles.noteInput, styles.webInput, { color: p.text }]}
        />

        <View style={styles.block}>
          <SectionLabel>Before photo</SectionLabel>
          {photoUri ? (
            <View>
              <Image source={{ uri: photoUri }} style={[styles.photo, { backgroundColor: p.surfaceAlt }]} />
              <Pressable
                onPress={() => {
                  discardPhoto(photoUri);
                  setPhotoUri(undefined);
                }}
                accessibilityLabel="Remove photo"
                hitSlop={8}
                style={styles.removePhoto}>
                <Feather name="x" size={16} color="#fff" />
              </Pressable>
            </View>
          ) : (
            <View style={styles.photoRow}>
              {Platform.OS !== 'web' ? (
                <PhotoTile icon="camera" label="Take photo" onPress={() => addPhoto('camera')} />
              ) : null}
              <PhotoTile icon="image" label="Choose photo" onPress={() => addPhoto('library')} />
            </View>
          )}
        </View>

        <View style={styles.block}>
          <SectionLabel>Remind me</SectionLabel>
          <ReminderPicker value={reminder} onChange={setReminder} />
        </View>
      </ScrollView>
    </Sheet>
  );
}

function PhotoTile({ icon, label, onPress }: { icon: 'camera' | 'image'; label: string; onPress: () => void }) {
  const p = usePalette();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.tile, { backgroundColor: p.surface, borderColor: p.border, opacity: pressed ? 0.7 : 1 }]}>
      <View style={[styles.tileIcon, { backgroundColor: p.accentSoft }]}>
        <Feather name={icon} size={18} color={p.accent} />
      </View>
      <Text style={[styles.tileText, { color: p.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  headerBtn: { fontSize: 16, fontWeight: '500' },
  save: { paddingHorizontal: 18, height: 34, borderRadius: radius.pill, justifyContent: 'center' },
  saveText: { fontSize: 15, fontWeight: '600' },
  body: { paddingHorizontal: 20, paddingTop: 8, gap: 4 },
  // Inputs are borderless; drop the browser focus ring in the web preview.
  webInput: Platform.select({ web: { outlineStyle: 'none' }, default: {} }) as object,
  titleInput: { fontSize: 26, fontWeight: '700', letterSpacing: -0.6, lineHeight: 32, paddingVertical: 8 },
  noteInput: { fontSize: 16, lineHeight: 22, paddingVertical: 6, minHeight: 40 },
  block: { marginTop: 24 },
  photoRow: { flexDirection: 'row', gap: 10 },
  tile: {
    flex: 1,
    height: 92,
    borderRadius: radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  tileIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  tileText: { fontSize: 14, fontWeight: '600' },
  photo: { width: '100%', height: 220, borderRadius: radius.lg },
  removePhoto: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
