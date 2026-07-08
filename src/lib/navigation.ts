export type CitizenScreen = 'parcel-lookup' | 'land-use-explainer' | 'dispute-form'

export type AppView = { mode: 'citizen'; screen: CitizenScreen } | { mode: 'field-officer' }
