import 'package:flutter/material.dart';

/// A go_router page shown as a modal bottom sheet, so a sheet can be a route
/// (`/attention`, spec §9) and still return to the screen that pushed it.
class SheetPage<T> extends Page<T> {
  const SheetPage({required this.child, super.key});
  final Widget child;

  @override
  Route<T> createRoute(BuildContext context) => ModalBottomSheetRoute<T>(
        settings: this,
        builder: (_) => child,
        isScrollControlled: true,
        useSafeArea: true,
        showDragHandle: true,
      );
}
