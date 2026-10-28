import { useCatalogOptions } from '../hooks/useCatalogOptions';
import type { CatalogKind } from '../types/book';

interface CatalogOptionsProps {
  /** Id of the `<datalist>`; the input points at it with `list`. */
  id: string;
  kind: CatalogKind;
  /** What the user has typed so far; the suggestions are searched with it. */
  text: string;
}

/** The suggestions of a catalog as a native `<datalist>`. Failing only means no suggestions. */
export function CatalogOptions({ id, kind, text }: CatalogOptionsProps) {
  const { data } = useCatalogOptions(kind, text);

  return (
    <datalist id={id}>
      {data?.map((item) => (
        <option key={item.id} value={item.name} />
      ))}
    </datalist>
  );
}
