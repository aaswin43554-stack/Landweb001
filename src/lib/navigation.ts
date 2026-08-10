export type CitizenScreen = 'parcel-lookup' | 'land-use-explainer' | 'dispute-form' | 'case-status'

export type AppView = 
  | { mode: 'citizen'; screen: CitizenScreen } 
  | { mode: 'field-officer' }
  | { mode: 'admin' }

