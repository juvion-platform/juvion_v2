import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/features/system/offline_banner.dart';

/// Three tabs; the fourth slot is reserved for the Companion (Release 3).
class AppShell extends StatelessWidget {
  const AppShell({required this.navigationShell, required this.kind, super.key});
  final StatefulNavigationShell navigationShell;
  final String kind;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final isStudent = kind == 'student';
    return Scaffold(
      body: Column(children: [const OfflineBanner(), Expanded(child: navigationShell)]),
      bottomNavigationBar: NavigationBar(
        selectedIndex: navigationShell.currentIndex,
        onDestinationSelected: (i) => navigationShell.goBranch(i, initialLocation: i == navigationShell.currentIndex),
        destinations: [
          NavigationDestination(icon: Icon(isStudent ? Icons.today_outlined : Icons.school_outlined), selectedIcon: Icon(isStudent ? Icons.today : Icons.school), label: isStudent ? l.tabToday : l.tabTeaching),
          NavigationDestination(icon: const Icon(Icons.forum_outlined), selectedIcon: const Icon(Icons.forum), label: l.tabSpaces),
          NavigationDestination(icon: const Icon(Icons.person_outline), selectedIcon: const Icon(Icons.person), label: l.tabMe),
        ],
      ),
    );
  }
}
