import type { SupabaseClient } from '@supabase/supabase-js';
import type { AgentEvent, AgentEventType } from '../types/index';

export class AgentEventEmitter {
  constructor(private readonly supabase: SupabaseClient) {}

  async emit(event: Omit<AgentEvent, 'timestamp'>): Promise<void> {
    const { error } = await this.supabase
      .from('agent_events')
      .insert({ ...event, timestamp: new Date().toISOString() });
    if (error) console.error('[AgentEventEmitter]', error.message);
  }
}
