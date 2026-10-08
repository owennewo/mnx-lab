// Minimal JSON Schema (2020-12 subset) checker for the contract schema tests:
// type, const, enum, properties, required, items, min/maxItems, minLength, pattern,
// minimum, maximum, exclusiveMinimum, $ref (local), allOf, anyOf, not, if/then.
// Unknown keywords throw, so the schema cannot silently rely on unchecked rules.
const KNOWN=new Set(['$schema','$id','$defs','title','description','type','const','enum','properties','required','items','minItems','maxItems','minLength','pattern','minimum','maximum','exclusiveMinimum','$ref','allOf','anyOf','not','if','then']);
const typeOf=x=>x===null?'null':Array.isArray(x)?'array':Number.isInteger(x)?'integer':typeof x;
export function schemaErrors(root,value,schema=root,path='$'){
 const errors=[];
 for(const key of Object.keys(schema))if(!KNOWN.has(key))throw Error(`Unsupported schema keyword ${key} at ${path}`);
 if(schema.$ref){const name=/^#\/\$defs\/(.+)$/.exec(schema.$ref)?.[1];if(!name||!root.$defs[name])throw Error('Bad $ref '+schema.$ref);errors.push(...schemaErrors(root,value,root.$defs[name],path));}
 if(schema.type){const types=[].concat(schema.type),t=typeOf(value);if(!types.some(x=>x===t||(x==='number'&&t==='integer')))return [...errors,`${path}: expected ${types.join('|')}`];}
 if('const' in schema&&value!==schema.const)errors.push(`${path}: expected ${JSON.stringify(schema.const)}`);
 if(schema.enum&&!schema.enum.includes(value))errors.push(`${path}: not in enum`);
 if(typeof value==='number'){
  if(schema.minimum!==undefined&&value<schema.minimum)errors.push(`${path}: below minimum`);
  if(schema.maximum!==undefined&&value>schema.maximum)errors.push(`${path}: above maximum`);
  if(schema.exclusiveMinimum!==undefined&&value<=schema.exclusiveMinimum)errors.push(`${path}: not above exclusiveMinimum`);
 }
 if(typeof value==='string'){
  if(schema.minLength!==undefined&&value.length<schema.minLength)errors.push(`${path}: too short`);
  if(schema.pattern&&!new RegExp(schema.pattern,'u').test(value))errors.push(`${path}: pattern`);
 }
 if(Array.isArray(value)){
  if(schema.minItems!==undefined&&value.length<schema.minItems)errors.push(`${path}: too few items`);
  if(schema.maxItems!==undefined&&value.length>schema.maxItems)errors.push(`${path}: too many items`);
  if(schema.items)value.forEach((v,i)=>errors.push(...schemaErrors(root,v,schema.items,`${path}[${i}]`)));
 }
 if(typeOf(value)==='object'){
  for(const k of schema.required??[])if(!(k in value))errors.push(`${path}: missing ${k}`);
  for(const [k,s] of Object.entries(schema.properties??{}))if(k in value)errors.push(...schemaErrors(root,value[k],s,`${path}.${k}`));
 }
 for(const s of schema.allOf??[])errors.push(...schemaErrors(root,value,s,path));
 if(schema.anyOf&&!schema.anyOf.some(s=>!schemaErrors(root,value,s,path).length))errors.push(`${path}: no anyOf branch matches`);
 if(schema.not&&!schemaErrors(root,value,schema.not,path).length)errors.push(`${path}: matches a forbidden shape`);
 if(schema.if&&!schemaErrors(root,value,schema.if,path).length&&schema.then)errors.push(...schemaErrors(root,value,schema.then,path));
 return errors;
}
export const defSchema=(root,name)=>({...root,$ref:`#/$defs/${name}`});
