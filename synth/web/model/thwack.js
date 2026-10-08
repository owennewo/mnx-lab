export const THWACK_STRENGTH_MAX=1.5;
export const THWACK_SETTLING=.1,THWACK_HOLD=.02;
export const thwackStrengthMapping={
 fromUnit(unit){
  if(!Number.isFinite(unit)||unit<0||unit>1)throw Error('Invalid thwack slider position');
  return unit===0?0:unit===1?THWACK_STRENGTH_MAX:THWACK_STRENGTH_MAX*Math.expm1(Math.log(100)*unit)/99;
 },
 toUnit(strength){
  if(!Number.isFinite(strength)||strength<0||strength>THWACK_STRENGTH_MAX)throw Error('Thwack strength must be 0–150%');
  return Math.log1p(strength/THWACK_STRENGTH_MAX*99)/Math.log(100);
 },
};
export const THWACK_V2={name:'Thwack strength',min:0,max:THWACK_STRENGTH_MAX,step:.001,default:0,log:true,mapping:thwackStrengthMapping,policy:'next pluck'};
export function thwackAmount(strength){
 thwackStrengthMapping.toUnit(strength);
 return strength*.1;
}
