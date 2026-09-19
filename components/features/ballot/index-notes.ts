/**
 * Every micro-interaction on the shelf, read against one question: does it
 * carry meaning this archive actually has? The nine marked `kept` are built
 * into the sheet. The rest carry the reason they were left off, because on a
 * page about deciding what matters, the cuts are the argument.
 */
export const INTERACTION_INDEX: { name: string; kept?: boolean; note: string }[] = [
  { name: 'PeekRating', kept: true, note: 'A rating is an opinion on record. Trying it before committing is the whole feature.' },
  { name: 'SwipeRow', kept: true, note: 'The queue is triage, done one-handed. Pull, read, let go.' },
  { name: 'WarmTooltip', kept: true, note: 'Six marks a row need names, and six delays would be six interruptions.' },
  { name: 'StatusMark', kept: true, note: 'Four statuses already exist in the archive. They needed one alphabet, not four icons.' },
  { name: 'RubberSegment', kept: true, note: 'Kind is the filter people reach for first, so it stays visible and grabbable.' },
  { name: 'SpringCheck', kept: true, note: 'A struck label is exactly what an exclusion does to a row.' },
  { name: 'GlideSelect', kept: true, note: 'Ordering is a decision about how to decide. The menu keeps your place while you weigh it.' },
  { name: 'SwipeToast', kept: true, note: 'Opting out is one pull away, so undo has to outlive the gesture. Hovering pauses the fuse.' },
  { name: 'BranchedMenu', kept: true, note: 'An index should draw the path to the shelf you are standing on.' },
  { name: 'FuseButton', note: 'A second undo mechanism. The toast already owns that job.' },
  { name: 'HoldButton', note: 'Nothing here is dangerous enough to hold a button down for.' },
  { name: 'SlideCommit', note: 'Built for slow, risky confirmations. Marking a row is neither.' },
  { name: 'PulseHeart', note: 'A like is a blunter version of the rating this page just added.' },
  { name: 'JellyRadio', note: 'Competes with the segmented control for the same choice.' },
  { name: 'SquishSwitch', note: 'Two states with no risk. A checkbox says it with less ceremony.' },
  { name: 'FlipCard', note: 'The back of a card is where information goes to hide.' },
  { name: 'TearTicket', note: 'Genuinely good, and it would be the second loud thing on a page that needs one.' },
  { name: 'FolderFloat', note: 'Opens on hover, which does not exist on the phone this is used from.' },
  { name: 'DodgeField', note: 'A control that runs from the pointer is a joke the fourth user stops laughing at.' },
  { name: 'ScrubField', note: 'No number here is worth dragging. Episodes are counted, not tuned.' },
  { name: 'WakeSlider', note: 'Same reason: nothing continuous to set.' },
  { name: 'CometDial', note: 'A dial looking for a value this archive does not store.' },
  { name: 'SloshGauge', note: 'Progress through a season is a fraction, not a tank of liquid.' },
  { name: 'CodeSlots', note: 'Belongs to signing in, two screens away from here.' },
  { name: 'BellToggle', note: 'Notification settings are not part of deciding what to watch.' },
  { name: 'SlingButton', note: 'Flick to send is a chat gesture borrowed into the wrong room.' },
  { name: 'PromptBar', note: 'There is no assistant on this page, and adding one to justify a component is backwards.' },
  { name: 'VoicePill', note: 'Nobody dictates a rating.' },
  { name: 'LatticeLoader', note: 'Agent status for a page with no agent.' },
  { name: 'CallChip', note: 'Tool-call telemetry. Wrong audience entirely.' },
  { name: 'ThoughtLine', note: 'Reasoning traces belong to a product that reasons.' },
  { name: 'RefineFrame', note: 'For images being generated. This archive links to artwork it does not own or make.' },
];
