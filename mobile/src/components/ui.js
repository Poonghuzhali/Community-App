import React, { useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import QRCode from 'react-native-qrcode-svg';
import { colors, radius, spacing, typography, shadow, statusColors } from '../theme';
import { initials } from '../utils/format';
import { useAuth } from '../context/AuthContext';
import { confirm } from '../utils/confirm';

/* ------------------------------------------------------------------ Screen */
export function Screen({ children, scroll = false, style, contentStyle, padded = true }) {
  if (!scroll) return <View style={[styles.screen, style]}>{children}</View>;
  return (
    <View style={styles.screen}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            padded && styles.screenPadded,
            { paddingBottom: spacing.xxl * 2 },
            contentStyle,
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/* ------------------------------------------------------------------ Header */
export function AppHeader({ title, subtitle, onBack, right, large = true, back = true }) {
  const navigation = useNavigation();
  // A back button is shown automatically on every screen pushed onto a stack
  // navigator (the tab roots sit in a tab navigator, so they stay back-free).
  const navigatorType = navigation?.getState?.()?.type;
  const canGoBack = navigatorType === 'stack' && typeof navigation?.canGoBack === 'function' && navigation.canGoBack();
  const showBack = Boolean(onBack) || (back && canGoBack);
  const handleBack = onBack || (() => navigation.goBack());

  return (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        {showBack ? (
          <TouchableOpacity
            onPress={handleBack}
            style={styles.backBtn}
            accessibilityLabel="Go back"
            accessibilityRole="button"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </TouchableOpacity>
        ) : null}
        <View style={{ flex: 1 }}>
          {large ? (
            <Text style={typography.h1} numberOfLines={1}>{title}</Text>
          ) : (
            <Text style={typography.h3} numberOfLines={1}>{title}</Text>
          )}
          {subtitle ? <Text style={[typography.small, { marginTop: 2 }]}>{subtitle}</Text> : null}
        </View>
        {right}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------- LogoutButton */
export function LogoutButton({ label, style, iconSize = 20 }) {
  const { logout } = useAuth();
  const onPress = () => confirm('Log out?', 'You will need your mobile OTP to sign back in.', 'Log out', logout);

  if (label) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.85}
        style={[styles.logoutPill, style]}
        accessibilityLabel="Log out"
        accessibilityRole="button"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="log-out-outline" size={16} color={colors.danger} />
        <Text style={styles.logoutPillText}>{label}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[styles.logoutBtn, style]}
      accessibilityLabel="Log out"
      accessibilityRole="button"
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Ionicons name="log-out-outline" size={iconSize} color={colors.danger} />
    </TouchableOpacity>
  );
}

/* Group of header actions (e.g. an add button + logout) laid out in a row. */
export function HeaderActions({ children, style }) {
  return <View style={[styles.headerActions, style]}>{children}</View>;
}

/* ------------------------------------------------------------------ Button */
export function Button({
  title, onPress, loading, disabled, variant = 'primary', icon, style, small = false, danger = false,
}) {
  const isDisabled = disabled || loading;
  const palette = {
    primary: { bg: colors.primary, fg: colors.textInverse, border: colors.primary },
    secondary: { bg: colors.primaryLight, fg: colors.primary, border: colors.primaryLight },
    outline: { bg: 'transparent', fg: colors.primary, border: colors.border },
    ghost: { bg: 'transparent', fg: colors.primary, border: 'transparent' },
    danger: { bg: colors.dangerBg, fg: colors.danger, border: colors.dangerBg },
    accent: { bg: colors.accent, fg: '#3A2408', border: colors.accent },
  }[danger ? 'danger' : variant];

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      disabled={isDisabled}
      style={[
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: palette.bg, borderColor: palette.border },
        isDisabled && { opacity: 0.55 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} size="small" />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={small ? 15 : 17} color={palette.fg} style={{ marginRight: 7 }} /> : null}
          <Text style={[typography.button, small && { fontSize: 13 }, { color: palette.fg }]}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

export function IconButton({ name, onPress, color = colors.text, size = 20, bg = colors.greyBg, style }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[styles.iconButton, { backgroundColor: bg }, style]}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Ionicons name={name} size={size} color={color} />
    </TouchableOpacity>
  );
}

/* ------------------------------------------------------------------- Input */
export function Input({ label, error, hint, icon, multiline, style, ...props }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[{ marginBottom: spacing.lg }, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View
        style={[
          styles.inputWrap,
          multiline && { height: 110, alignItems: 'flex-start', paddingVertical: spacing.md },
          focused && { borderColor: colors.primary, backgroundColor: '#FBFDFC' },
          error && { borderColor: colors.danger },
        ]}
      >
        {icon ? <Ionicons name={icon} size={17} color={focused ? colors.primary : colors.grey} style={{ marginRight: 8 }} /> : null}
        <TextInput
          style={[styles.input, multiline && { height: '100%', textAlignVertical: 'top' }]}
          placeholderTextColor={colors.grey}
          multiline={multiline}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...props}
        />
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function SearchBar({ value, onChangeText, placeholder = 'Search…', style }) {
  return (
    <View style={[styles.searchBar, style]}>
      <Ionicons name="search" size={17} color={colors.grey} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.grey}
        style={{ flex: 1, marginLeft: spacing.sm, color: colors.text, fontSize: 15 }}
        returnKeyType="search"
      />
      {value ? (
        <TouchableOpacity onPress={() => onChangeText('')}>
          <Ionicons name="close-circle" size={17} color={colors.grey} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------------------- Card */
export function Card({ children, style, onPress, ...rest }) {
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper
      activeOpacity={0.9}
      onPress={onPress}
      style={[styles.card, style]}
      {...rest}
    >
      {children}
    </Wrapper>
  );
}

export function Section({ title, action, onAction, children }) {
  return (
    <View style={{ marginTop: spacing.xl }}>
      <View style={styles.sectionHead}>
        <Text style={typography.h3}>{title}</Text>
        {action ? (
          <TouchableOpacity onPress={onAction}>
            <Text style={styles.sectionAction}>{action}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {children}
    </View>
  );
}

/* ----------------------------------------------------------------- Status */
export function StatusPill({ status, label, style }) {
  const palette = statusColors[status] || { bg: colors.greyBg, fg: colors.textMuted };
  return (
    <View style={[styles.pill, { backgroundColor: palette.bg }, style]}>
      <Text style={[styles.pillText, { color: palette.fg }]}>{label || palette.label || status}</Text>
    </View>
  );
}

export function Chip({ label, active, onPress, style }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      style={[styles.chip, active && { backgroundColor: colors.primary, borderColor: colors.primary }, style]}
    >
      <Text style={[styles.chipText, active && { color: colors.textInverse }]} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}

export function Badge({ count, style }) {
  if (!count) return null;
  return (
    <View style={[styles.badge, style]}>
      <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
    </View>
  );
}

/* ----------------------------------------------------------------- Avatar */
export function Avatar({ name, size = 40, color = colors.primary, style }) {
  return (
    <View
      style={[
        {
          width: size, height: size, borderRadius: size / 2,
          backgroundColor: color + '1A', alignItems: 'center', justifyContent: 'center',
        },
        style,
      ]}
    >
      <Text style={{ color, fontWeight: '800', fontSize: size * 0.36 }}>{initials(name)}</Text>
    </View>
  );
}

/* ------------------------------------------------------------ Empty/Load */
export function EmptyState({ icon = 'file-tray-outline', title, message, action, onAction }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={30} color={colors.primary} />
      </View>
      <Text style={[typography.h3, { marginTop: spacing.lg, textAlign: 'center' }]}>{title}</Text>
      {message ? <Text style={[typography.small, { textAlign: 'center', marginTop: 4, maxWidth: 280 }]}>{message}</Text> : null}
      {action ? <Button title={action} onPress={onAction} style={{ marginTop: spacing.lg }} small /> : null}
    </View>
  );
}

export function Loader({ label = 'Loading…' }) {
  return (
    <View style={styles.empty}>
      <ActivityIndicator color={colors.primary} size="large" />
      <Text style={[typography.small, { marginTop: spacing.md }]}>{label}</Text>
    </View>
  );
}

export function Banner({ message, type = 'info', onClose }) {
  const palette = {
    info: { bg: colors.infoBg, fg: colors.info, icon: 'information-circle' },
    success: { bg: colors.successBg, fg: colors.success, icon: 'checkmark-circle' },
    warning: { bg: colors.warningBg, fg: '#9A7100', icon: 'alert-circle' },
    danger: { bg: colors.dangerBg, fg: colors.danger, icon: 'close-circle' },
  }[type];
  if (!message) return null;
  return (
    <View style={[styles.banner, { backgroundColor: palette.bg }]}>
      <Ionicons name={palette.icon} size={18} color={palette.fg} />
      <Text style={[styles.bannerText, { color: palette.fg }]}>{message}</Text>
      {onClose ? (
        <TouchableOpacity onPress={onClose} style={{ marginLeft: 'auto' }}>
          <Ionicons name="close" size={16} color={palette.fg} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------------- Stat card */
export function StatCard({ label, value, icon, color = colors.primary, onPress, style }) {
  return (
    <Card style={[styles.stat, style]} onPress={onPress}>
      <View style={[styles.statIcon, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel} numberOfLines={1}>{label}</Text>
    </Card>
  );
}

/* ------------------------------------------------------------------ Rows */
export function ListRow({ title, subtitle, right, rightText, onPress, icon, style, last = false }) {
  return (
    <TouchableOpacity activeOpacity={onPress ? 0.7 : 1} onPress={onPress} style={[styles.row, style]} disabled={!onPress}>
      {icon ? (
        <View style={styles.rowIcon}>
          <Ionicons name={icon} size={18} color={colors.primary} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={typography.body} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={[typography.small, { marginTop: 2 }]} numberOfLines={2}>{subtitle}</Text> : null}
      </View>
      {right || rightText ? (
        <View style={{ marginLeft: spacing.md }}>{right || <Text style={styles.rowRight}>{rightText}</Text>}</View>
      ) : onPress ? (
        <Ionicons name="chevron-forward" size={17} color={colors.grey} style={{ marginLeft: spacing.sm }} />
      ) : null}
    </TouchableOpacity>
  );
}

/* -------------------------------------------------------------------- QR */
export function QRView({ value, size = 200 }) {
  if (!value) return null;
  return (
    <View style={styles.qrWrap}>
      <QRCode value={value} size={size} color={colors.text} backgroundColor="#FFFFFF" />
    </View>
  );
}

export function Divider({ style }) {
  return <View style={[styles.divider, style]} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  screenInner: { flex: 1 },
  screenPadded: { padding: spacing.lg },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm, backgroundColor: colors.bg },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  backBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: colors.card,
    alignItems: 'center', justifyContent: 'center', marginRight: spacing.md, borderWidth: 1, borderColor: colors.border,
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  logoutBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.dangerBg,
    alignItems: 'center', justifyContent: 'center',
  },
  logoutPill: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.dangerBg,
    borderRadius: radius.pill, paddingHorizontal: 12, height: 38,
  },
  logoutPillText: { color: colors.danger, fontWeight: '700', fontSize: 13, marginLeft: 6 },
  button: {
    height: 50, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', paddingHorizontal: spacing.lg, borderWidth: 1,
  },
  buttonSmall: { height: 38, borderRadius: radius.sm, paddingHorizontal: spacing.md },
  iconButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 13, fontWeight: '700', color: colors.textMuted, marginBottom: 7, letterSpacing: 0.2 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card,
    borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: spacing.md, minHeight: 50,
  },
  input: { flex: 1, fontSize: 15, color: colors.text, paddingVertical: spacing.md },
  errorText: { color: colors.danger, fontSize: 12, marginTop: 5 },
  hint: { color: colors.textMuted, fontSize: 12, marginTop: 5 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md, height: 46,
  },
  card: {
    backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg,
    borderWidth: 1, borderColor: colors.border, ...shadow.card,
  },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  sectionAction: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, alignSelf: 'flex-start' },
  pillText: { fontSize: 11.5, fontWeight: '800', letterSpacing: 0.3 },
  chip: {
    alignSelf: 'center', flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 36, paddingHorizontal: 14, borderRadius: radius.pill,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, marginRight: spacing.sm,
  },
  chipText: { fontSize: 13, lineHeight: 16, fontWeight: '600', color: colors.textMuted },
  badge: {
    minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.danger,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 56, paddingHorizontal: spacing.xl },
  emptyIcon: {
    width: 66, height: 66, borderRadius: 33, backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.lg,
  },
  bannerText: { flex: 1, fontSize: 13.5, fontWeight: '600', lineHeight: 19 },
  stat: { flex: 1, padding: spacing.md, minWidth: 100 },
  statIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  statValue: { fontSize: 22, fontWeight: '800', color: colors.text },
  statLabel: { fontSize: 11.5, color: colors.textMuted, marginTop: 2 },
  row: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card,
    padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  rowIcon: {
    width: 36, height: 36, borderRadius: 12, backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center', marginRight: spacing.md,
  },
  rowRight: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  qrWrap: { alignItems: 'center', justifyContent: 'center', padding: spacing.lg, backgroundColor: '#fff', borderRadius: radius.lg },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
});

export default {
  Screen, AppHeader, LogoutButton, HeaderActions, Button, IconButton, Input, SearchBar, Card, Section, StatusPill,
  Chip, Badge, Avatar, EmptyState, Loader, Banner, StatCard, ListRow, QRView, Divider,
};
