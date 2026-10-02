import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';

/// Plain text with its http(s) links made tappable. Notice bodies are plain text and
/// links are detected at render time (spec §5).
class LinkedText extends StatefulWidget {
  const LinkedText(this.text, {required this.onOpen, this.style, super.key});
  final String text;
  final ValueChanged<Uri> onOpen;
  final TextStyle? style;

  static final _link = RegExp(r'https?://[^\s<>"]+');
  static const _trailing = ".,;:!?)'";

  /// The text split into plain runs and links, in order; a link is a non-null [Uri].
  static List<(String, Uri?)> segments(String text) {
    final out = <(String, Uri?)>[];
    var at = 0;
    for (final m in _link.allMatches(text)) {
      var url = m.group(0)!;
      while (url.isNotEmpty && _trailing.contains(url[url.length - 1])) {
        url = url.substring(0, url.length - 1);
      }
      final uri = Uri.tryParse(url);
      if (uri == null || !uri.hasAuthority) continue;
      if (m.start > at) out.add((text.substring(at, m.start), null));
      out.add((url, uri));
      at = m.start + url.length;
    }
    if (at < text.length) out.add((text.substring(at), null));
    return out;
  }

  @override
  State<LinkedText> createState() => _LinkedTextState();
}

class _LinkedTextState extends State<LinkedText> {
  final _recognizers = <TapGestureRecognizer>[];
  late List<(String, Uri?)> _segments;

  @override
  void initState() {
    super.initState();
    _parse();
  }

  @override
  void didUpdateWidget(LinkedText old) {
    super.didUpdateWidget(old);
    if (old.text != widget.text) _parse();
  }

  void _parse() {
    _disposeRecognizers();
    _segments = LinkedText.segments(widget.text);
    for (final (_, uri) in _segments) {
      if (uri != null) _recognizers.add(TapGestureRecognizer()..onTap = () => widget.onOpen(uri));
    }
  }

  void _disposeRecognizers() {
    for (final r in _recognizers) {
      r.dispose();
    }
    _recognizers.clear();
  }

  @override
  void dispose() {
    _disposeRecognizers();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final linkStyle = TextStyle(color: Theme.of(context).colorScheme.primary, decoration: TextDecoration.underline);
    var i = 0;
    return Text.rich(TextSpan(
      style: widget.style,
      children: [
        for (final (text, uri) in _segments)
          uri == null ? TextSpan(text: text) : TextSpan(text: text, style: linkStyle, recognizer: _recognizers[i++]),
      ],
    ));
  }
}
