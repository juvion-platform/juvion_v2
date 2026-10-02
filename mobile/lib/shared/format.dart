import 'package:intl/intl.dart';

/// Wall-clock in the device's zone; institution timezone display arrives with Today (sub-project 4).
String hhmm(DateTime t) => DateFormat.Hm('en_IN').format(t.toLocal());
String dayAndDate(DateTime t) => DateFormat('EEEE, d MMMM', 'en_IN').format(t.toLocal());

/// "Fri 3 Oct, 17:00": notice deadlines, publish times and acknowledgement times.
String dayMonthTime(DateTime t) => DateFormat('EEE d MMM, HH:mm', 'en_IN').format(t.toLocal());
