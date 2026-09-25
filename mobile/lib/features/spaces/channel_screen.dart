import 'package:flutter/material.dart';

/// Placeholder — replaced by the Spaces task.
class ChannelScreen extends StatelessWidget {
  const ChannelScreen({required this.channelId, super.key});
  final String channelId;
  @override
  Widget build(BuildContext context) => Scaffold(appBar: AppBar(title: Text('/spaces/$channelId')));
}
