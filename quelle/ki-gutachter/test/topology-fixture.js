// Explicit interpretation fixture for the simple coaxial test drawings. Real
// requests must supply their own drawing-side topology evidence.
export const coaxialDrawingTopology=(overrides={})=>({axisRelationship:'coaxial',cavityOpening:'none',driveOpening:'none',outerContour:'round-or-hex',requiredOperations:[],engineCoverage:'complete',evidence:{origin:'drawing',page:1,reference:'Ansicht und Schnitt der Testzeichnung',quote:'Koaxiale Außenkontur ohne zusätzliche Sonderoperationen'},...overrides});
