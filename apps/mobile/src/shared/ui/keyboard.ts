import { cssInterop } from 'nativewind';
import {
  KeyboardAvoidingView,
  KeyboardAwareScrollView,
} from 'react-native-keyboard-controller';

// On Android the app is edge-to-edge, so the window no longer shrinks when the keyboard opens:
// every screen with inputs has to move out of its way. These components do it on both platforms.
// NativeWind only maps className on React Native's own components, so these are registered here.
cssInterop(KeyboardAvoidingView, { className: 'style' });
cssInterop(KeyboardAwareScrollView, {
  className: 'style',
  contentContainerClassName: 'contentContainerStyle',
});

// Space left between the focused input and the top of the keyboard.
export const KEYBOARD_BOTTOM_OFFSET = 24;

export { KeyboardAvoidingView, KeyboardAwareScrollView };
