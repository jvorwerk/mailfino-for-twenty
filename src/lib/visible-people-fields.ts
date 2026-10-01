import { MetadataApiClient } from 'twenty-client-sdk/metadata';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type TwentyFieldMetadata = {
  id: string;
  name: string;
  label: string;
  type: string;
};

export type PeopleViewFields = {
  sourceFields: string[];
  labels: Record<string, string>;
};

/**
 * Resolves one known People view through Twenty's official metadata API.
 * Called by the chooser after the prepare route captured the active view ID from Twenty's host request.
 */
export async function loadPeopleViewFieldsForView(viewId: string): Promise<PeopleViewFields> {
  if (!uuidPattern.test(viewId))
    throw new Error('The active Twenty People view is invalid.');
  const metadata = new MetadataApiClient();
  const objectsResponse = await metadata.query({
    objects: {
      __args: { paging: { first: 100 }, filter: {} },
      edges: {
        node: {
          id: true,
          namePlural: true,
          fieldsList: { id: true, name: true, label: true, type: true },
        },
      },
    },
  });
  const people = objectsResponse.objects.edges
    .map(edge => edge.node)
    .find(object => object.namePlural === 'people');
  if (!people)
    throw new Error('The Twenty People metadata could not be identified.');

  const response = await metadata.query({
    getViewFields: {
      __args: { viewId },
      fieldMetadataId: true,
      isVisible: true,
      isActive: true,
      position: true,
    },
  });
  const viewFields = response.getViewFields
    .filter(field => field.isVisible && field.isActive && uuidPattern.test(field.fieldMetadataId))
    .sort((left, right) => left.position - right.position);
  const fieldsById = new Map(people.fieldsList.map(field => [field.id, field as TwentyFieldMetadata]));
  const fields = viewFields.map(viewField => fieldsById.get(viewField.fieldMetadataId));

  const sourceFields = [...new Set(fields.flatMap(field => field ? expandPeopleField(field) : []))];
  const labels = Object.fromEntries(fields.flatMap(field => field
    ? expandPeopleField(field).map(sourceField => [sourceField, field.label?.trim() || field.name])
    : []));
  return { sourceFields, labels };
}

/** Expands Twenty compound People fields to the source paths used by mailfino's existing mapping runtime. */
export function expandPeopleField(field: Pick<TwentyFieldMetadata, 'name' | 'type'>): string[] {
  const name = field.name?.trim() ?? '';
  const type = field.type?.trim().toUpperCase() ?? '';
  if (!/^[A-Za-z0-9_]+$/.test(name))
    return [];
  if (type === 'FULL_NAME')
    return [`${name}.firstName`, `${name}.lastName`];
  if (type === 'EMAILS')
    return [`${name}.primaryEmail`];
  if (type === 'PHONES')
    return [`${name}.primaryPhoneNumber`, `${name}.primaryPhoneCountryCode`];
  if (type === 'ADDRESS')
    return ['addressStreet1', 'addressStreet2', 'addressPostcode', 'addressCity', 'addressState', 'addressCountry']
      .map(part => `${name}.${part}`);
  if (type === 'RELATION' && name === 'company')
    return ['companyName'];
  if (['RELATION', 'MORPH_RELATION', 'ACTOR', 'ARRAY', 'RAW_JSON', 'FILES', 'LINKS'].includes(type))
    return [];
  return [name];
}
