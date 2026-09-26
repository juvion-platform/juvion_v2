import 'dart:convert';
import 'dart:math';

class PendingAction {
  PendingAction({
    required this.id,
    required this.type,
    required this.payload,
    required this.createdAt,
    this.attempts = 0,
    this.lastError,
  });
  factory PendingAction.create(String type, Map<String, dynamic> payload) => PendingAction(
        id: '${DateTime.now().microsecondsSinceEpoch}-${Random().nextInt(1 << 20)}',
        type: type,
        payload: payload,
        createdAt: DateTime.now(),
      );
  final String id;
  final String type; // settings.patch | channel.mute | channel.unmute | channel.read
  final Map<String, dynamic> payload;
  final DateTime createdAt;
  final int attempts;
  final String? lastError;
  String get payloadJson => jsonEncode(payload);
}
