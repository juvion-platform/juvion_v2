import { EventEmitter } from 'events';

// Cross-module event bus. Will migrate to BullMQ for durable async processing.
export const eventBus = new EventEmitter();
eventBus.setMaxListeners(50);

// Event name conventions: "module:entity:action"
// e.g. "admissions:applicant:enrolled", "finance:payment:received", "welfare:crisis:detected"
