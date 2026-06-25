export type StepStatus = 
  | 'pending' 
  | 'awaiting_approval' 
  | 'approved' 
  | 'denied' 
  | 'executing' 
  | 'done' 
  | 'failed';

export type Step = {
  id: string;
  description: string;
  tool: string;        // capability name
  args: unknown;
  reversible: boolean; // if true, requires approval before execution
  status: StepStatus;
};

export type Plan = {
  id: string;
  goal: string;
  steps: Step[];
  created_at: string;
};

export type Capability = {
  name: string;
  description: string;
  schema: unknown;  // JSON Schema for args
  reversible: boolean;
};

export type ApprovalRequest = {
  plan_id: string;
  step_id: string;
  description: string;
  payload: unknown;
};
