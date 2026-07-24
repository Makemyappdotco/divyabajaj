-- Cover foreign keys used by production workflows and cleanup queries.

create index if not exists analytics_events_session_idx
  on public.analytics_events(session_id);

create index if not exists appointment_status_history_appointment_idx
  on public.appointment_status_history(appointment_id);

create index if not exists appointments_order_idx
  on public.appointments(order_id);

create index if not exists calendar_sync_events_appointment_idx
  on public.calendar_sync_events(appointment_id);

create index if not exists communication_messages_appointment_idx
  on public.communication_messages(appointment_id);

create index if not exists communication_messages_report_idx
  on public.communication_messages(report_id);

create index if not exists generated_documents_report_version_idx
  on public.generated_documents(report_version_id);

create index if not exists slot_holds_lead_idx
  on public.slot_holds(lead_id);

create index if not exists slot_holds_order_idx
  on public.slot_holds(order_id);
