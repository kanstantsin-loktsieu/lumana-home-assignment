import { ImageLink, ImageRendition } from '../models/image-rendition';
import { NasaItemDto, NasaLinkDto, NasaSearchResponseDto } from '../models/nasa-images-dto';
import { SearchPage, SearchResultItem } from '../models/search-result';

/** Renditions for the dialog image, best first. */
const DISPLAY_PRIORITY: readonly ImageRendition[] = ['large', 'medium', 'small', 'thumb'];

/** Matches only displayable renditions, so `~orig` links resolve to `null` and are never picked. */
const DISPLAYABLE_RENDITION_SUFFIX = /~(large|medium|small|thumb)\.[a-z0-9]+$/i;

const renditionOf = (href: string): ImageRendition | null => {
  const path = href.split(/[?#]/, 1)[0];
  const match = DISPLAYABLE_RENDITION_SUFFIX.exec(path);
  return match ? (match[1].toLowerCase() as ImageRendition) : null;
};

const toImageLink = (link: NasaLinkDto): ImageLink => ({
  href: link.href,
  width: link.width ?? null,
  height: link.height ?? null,
});

const imageLinks = (links: readonly NasaLinkDto[]): NasaLinkDto[] =>
  links.filter((link) => link.render === undefined || link.render === 'image');

/**
 * Picks the best rendition listed in the item's `links[]`. The available set varies per item (some
 * have only `~thumb` + `~orig`), so URLs are never derived by swapping the suffix.
 */
const pickDisplayLink = (links: readonly NasaLinkDto[]): ImageLink | null => {
  const candidates = imageLinks(links);
  for (const rendition of DISPLAY_PRIORITY) {
    const link = candidates.find((candidate) => renditionOf(candidate.href) === rendition);
    if (link) {
      return toImageLink(link);
    }
  }
  const preview = candidates.find((candidate) => candidate.rel === 'preview');
  return preview ? toImageLink(preview) : null;
};

const pickThumbLink = (links: readonly NasaLinkDto[]): ImageLink | null => {
  const candidates = imageLinks(links);
  const link =
    candidates.find((candidate) => candidate.rel === 'preview') ??
    candidates.find((candidate) => renditionOf(candidate.href) === 'small');
  return link ? toImageLink(link) : null;
};

const mapItem = (item: NasaItemDto): SearchResultItem | null => {
  const data = item.data[0];
  const links = item.links ?? [];
  const display = pickDisplayLink(links);
  const thumb = pickThumbLink(links) ?? display;
  if (!data || !display || !thumb) {
    return null;
  }
  return {
    nasaId: data.nasa_id,
    title: data.title,
    dateCreated: data.date_created,
    center: data.center ?? null,
    thumbUrl: thumb.href,
    imageUrl: display.href,
    imageWidth: display.width,
    imageHeight: display.height,
  };
};

/** Maps a search response; items that cannot be shown or opened (no data or no image link) are dropped. */
export const mapSearchResponse = (dto: NasaSearchResponseDto): SearchPage => ({
  items: dto.collection.items
    .map(mapItem)
    .filter((item): item is SearchResultItem => item !== null),
  totalHits: dto.collection.metadata.total_hits,
  fetchedCount: dto.collection.items.length,
});
