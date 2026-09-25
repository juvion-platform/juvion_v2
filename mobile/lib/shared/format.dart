import 'package:intl/intl.dart';

/// Wall-clock in the device's zone; institution timezone display arrives with Today (sub-project 4).
String hhmm(DateTime t) => DateFormat.Hm('en_IN').format(t.toLocal());
String dayAndDate(DateTime t) => DateFormat('EEEE, d MMMM', 'en_IN').format(t.toLocal());
