// lib/services/event_bus.dart
import 'dart:async';
import 'package:flutter/foundation.dart';

class QueueUpdateEvent {
  final String clinicId;
  final String? doctorId; // Add doctorId field
  final Map<String, dynamic> queueData;

  QueueUpdateEvent({
    required this.clinicId,
    this.doctorId,
    required this.queueData
  });
}

class ClinicStatusUpdateEvent {
  final String clinicId;
  final Map<String, dynamic> statusData;

  ClinicStatusUpdateEvent({required this.clinicId, required this.statusData});
}

class DoctorAvailabilityUpdateEvent {
  final String clinicId;
  final String doctorId;
  final String doctorName;
  final bool isAvailable;
  final String lastStatusChange;

  DoctorAvailabilityUpdateEvent({
    required this.clinicId,
    required this.doctorId,
    required this.doctorName,
    required this.isAvailable,
    required this.lastStatusChange,
  });
}

class PatientUpdateEvent {
  final String patientId;
  final Map<String, dynamic> updateData;

  PatientUpdateEvent({required this.patientId, required this.updateData});
}

class PatientServedEvent {
  final String patientId;
  final String queueId;

  PatientServedEvent({required this.patientId, required this.queueId});
}

class SystemNotificationEvent {
  final String type;
  final String message;
  final Map<String, dynamic> data;

  SystemNotificationEvent({
    required this.type,
    required this.message,
    required this.data,
  });
}

class BookingHistoryUpdateEvent {
  final String patientId;
  final Map<String, dynamic> bookingData;

  BookingHistoryUpdateEvent({
    required this.patientId,
    required this.bookingData,
  });
}

class EventBus {
  static final EventBus _instance = EventBus._internal();
  factory EventBus() => _instance;
  EventBus._internal();

  final _queueUpdateController = StreamController<QueueUpdateEvent>.broadcast();
  final _clinicStatusController = StreamController<ClinicStatusUpdateEvent>.broadcast();
  final _doctorAvailabilityController = StreamController<DoctorAvailabilityUpdateEvent>.broadcast();
  final _patientUpdateController = StreamController<PatientUpdateEvent>.broadcast();
  final _patientServedController = StreamController<PatientServedEvent>.broadcast();
  final _systemNotificationController = StreamController<SystemNotificationEvent>.broadcast();
  final _bookingHistoryController = StreamController<BookingHistoryUpdateEvent>.broadcast();

  Stream<QueueUpdateEvent> get onQueueUpdate => _queueUpdateController.stream;
  Stream<ClinicStatusUpdateEvent> get onClinicStatusUpdate => _clinicStatusController.stream;
  Stream<DoctorAvailabilityUpdateEvent> get onDoctorAvailabilityUpdate => _doctorAvailabilityController.stream;
  Stream<PatientUpdateEvent> get onPatientUpdate => _patientUpdateController.stream;
  Stream<PatientServedEvent> get onPatientServed => _patientServedController.stream;
  Stream<SystemNotificationEvent> get onSystemNotification => _systemNotificationController.stream;
  Stream<BookingHistoryUpdateEvent> get onBookingHistoryUpdate => _bookingHistoryController.stream;

  void emitQueueUpdate(QueueUpdateEvent event) {
    _queueUpdateController.add(event);
  }

  void emitClinicStatusUpdate(ClinicStatusUpdateEvent event) {
    _clinicStatusController.add(event);
  }

  void emitDoctorAvailabilityUpdate(DoctorAvailabilityUpdateEvent event) {
    _doctorAvailabilityController.add(event);
  }

  void emitPatientUpdate(PatientUpdateEvent event) {
    _patientUpdateController.add(event);
  }

  void emitPatientServed(PatientServedEvent event) {
    _patientServedController.add(event);
  }

  void emitSystemNotification(SystemNotificationEvent event) {
    _systemNotificationController.add(event);
  }

  void emitBookingHistoryUpdate(BookingHistoryUpdateEvent event) {
    _bookingHistoryController.add(event);
  }

  void dispose() {
    _queueUpdateController.close();
    _clinicStatusController.close();
    _doctorAvailabilityController.close();
    _patientUpdateController.close();
    _patientServedController.close();
    _systemNotificationController.close();
    _bookingHistoryController.close();
  }
}