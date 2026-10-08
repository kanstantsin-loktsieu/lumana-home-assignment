import type { ImageRecord } from '../../shared/models/image-record';
import type { NasaItemDto, NasaLinkDto, NasaSearchResponseDto } from '../models/nasa-images-dto';

type ImageRendition = 'large' | 'medium' | 'small' | 'thumb';

// same rendition rules as the frontend mapper
const DISPLAY_PRIORITY: readonly ImageRendition[] = ['large', 'medium', 'small', 'thumb'];

// displayable renditions only, so `~orig` links (full-size originals) are never picked
const DISPLAYABLE_RENDITION_SUFFIX = /~(large|medium|small|thumb)\.[a-z0-9]+$/i;

const renditionOf = (href: string): ImageRendition | null => {
  const path = href.split(/[?#]/, 1)[0] ?? href;
  const match = DISPLAYABLE_RENDITION_SUFFIX.exec(path);
  return match?.[1] ? (match[1].toLowerCase() as ImageRendition) : null;
};

const imageLinks = (links: readonly NasaLinkDto[]): NasaLinkDto[] =>
  links.filter((link) => link.render === undefined || link.render === 'image');

const pickImageUrl = (links: readonly NasaLinkDto[]): string | null => {
  for (const rendition of DISPLAY_PRIORITY) {
    const link = links.find((candidate) => renditionOf(candidate.href) === rendition);
    if (link) return link.href;
  }
  return links.find((candidate) => candidate.rel === 'preview')?.href ?? null;
};

const pickThumbUrl = (links: readonly NasaLinkDto[]): string | null =>
  (
    links.find((candidate) => candidate.rel === 'preview') ??
    links.find((candidate) => renditionOf(candidate.href) === 'small')
  )?.href ?? null;

const nullIfBlank = (value: string | undefined): string | null =>
  value === undefined || value.trim() === '' ? null : value;

const toImageRecord = (item: NasaItemDto): ImageRecord | null => {
  const data = item.data[0];
  if (!data) return null;
  const links = imageLinks(item.links ?? []);
  const imageUrl = pickImageUrl(links);
  return {
    nasaId: data.nasa_id,
    title: data.title,
    description: nullIfBlank(data.description),
    dateCreated: data.date_created,
    center: nullIfBlank(data.center),
    keywords: data.keywords ?? [],
    photographer: nullIfBlank(data.photographer),
    thumbUrl: pickThumbUrl(links) ?? imageUrl,
    imageUrl,
  };
};

// unlike the frontend, items without an image link are kept: the dataset is metadata
export const toImageRecords = (dto: NasaSearchResponseDto): readonly ImageRecord[] =>
  dto.collection.items.map(toImageRecord).filter((record) => record !== null);
