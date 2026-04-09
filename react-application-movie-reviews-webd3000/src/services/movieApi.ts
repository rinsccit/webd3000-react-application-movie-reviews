import type { Movie } from "../types/Movie";
import type { Review } from "../types/Review";

/* This file contains all the functions and helpers for talking to the backend A.P.I.
   It helps the rest of the application fetch movies and reviews and makes sure data is always in the right format. */

// All A.P.I calls start from this base path. In development, Vite forwards '/api' to the local backend
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";

// Custom error type so the rest of the application can react to H.T.T.P status codes
class ApiResponseError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// Checks if a value is an object (used for safely reading fields from A.P.I responses)
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

// Tries several possible field names because backend payloads can vary between environments
function getField(record: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null) {
      return value;
    }
  }
  return undefined;
}

// Converts unknown values to text for display (returns fallback if not possible)
function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number") {
    return String(value);
  }
  return fallback;
}

// Converts unknown values to numbers for calculations (returns fallback if not possible)
function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

// Some A.P.Is send genre as a list while others send one string and this function handles both
function asGenre(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    return value
      .filter((entry): entry is string => typeof entry === "string")
      .join(", ");
  }
  return "";
}

// Converts different publish-status styles into one true or false value (handles 'published', 'draft' etc)
function asBoolean(value: unknown, fallback = true): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const lowerValue = value.toLowerCase();
    if (lowerValue === "true" || lowerValue === "published" || lowerValue === "active") {
      return true;
    }
    if (lowerValue === "false" || lowerValue === "draft" || lowerValue === "unpublished" || lowerValue === "inactive") {
      return false;
    }
  }
  return fallback;
}

// Finds an array payload even when the backend wraps it in another object (e.g { data: [...] })
function getArrayPayload(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!isRecord(payload)) {
    return [];
  }

  const candidates = ["data", "items", "results", "value", "movies", "reviews"];

  for (const key of candidates) {
    const value = payload[key];
    if (Array.isArray(value)) {
      return value;
    }
  }

  // Some A.P.Is wrap arrays under custom property names
  for (const value of Object.values(payload)) {
    if (Array.isArray(value)) {
      return value;
    }
  }

  return [];
}

// Detects whether an object probably represents a review (by checking for common review fields)
function isLikelyReviewRecord(record: Record<string, unknown>): boolean {
  const reviewHints = [
    "criticName",
    "critic",
    "reviewerName",
    "comment",
    "reviewText",
    "content",
    "body",
    "description",
    "score",
    "rating",
    "criticScore",
    "publishedAt",
    "publishedDate",
    "timePublishedAgo",
  ];
  return reviewHints.some((key) => record[key] !== undefined && record[key] !== null);
}

// These are known movie ID field names observed across different backend conventions.
const MOVIE_ID_FIELD_KEYS = ["movieId", "movieID", "MovieId", "movie_id", "movie", "filmId", "filmID"];

// Checks if the backend explicitly linked the review to a movie (for filtering accuracy)
function hasExplicitMovieId(rawReview: Record<string, unknown>): boolean {
  const movieIdValue = getField(rawReview, MOVIE_ID_FIELD_KEYS);

  if (movieIdValue === undefined || movieIdValue === null) {
    return false;
  }

  if (typeof movieIdValue === "string") {
    return movieIdValue.trim().length > 0;
  }

  if (typeof movieIdValue === 'number') {
    return Number.isFinite(movieIdValue);
  }

  return true;
}

// Normalizes IDs for reliable text comparison (e.g lowercase and trimmed)
function normalizeId(value: string): string {
  return value.trim().toLowerCase();
}

// Finds one object payload even if the backend wraps it in a data container (e.g { data: {...} })
function getObjectPayload(payload: unknown): Record<string, unknown> | null {
  if (isRecord(payload)) {
    if ("id" in payload || "title" in payload || "synopsis" in payload) {
      return payload;
    }

    const candidates = ["data", "item", "result", "movie", "review"];

    for (const key of candidates) {
      const value = payload[key];
      if (isRecord(value)) {
        return value;
      }
    }
  }

  if (Array.isArray(payload) && payload.length > 0 && isRecord(payload[0])) {
    return payload[0];
  }

  return null;
}

// Converts raw movie payloads into the application's movie model (ensures all fields are present and correct)
function normalizeMovie(rawMovie: Record<string, unknown>): Movie {
  const imageValue = asString(getField(rawMovie, ["image", "imageUrl", "poster", "posterUrl", "posterImage"]));
  const genreValue = asGenre(getField(rawMovie, ["genre", "genres", "category", "categories"]));

  return {
    id: asString(getField(rawMovie, ["id", "movieId", "_id"]), crypto.randomUUID()),
    title: asString(getField(rawMovie, ["title", "name"]), "Untitled Movie"),
    image: imageValue || "https://placehold.co/400x600?text=No+Poster",
    synopsis: asString(getField(rawMovie, ["synopsis", "description", "summary"]), "No synopsis available yet."),
    genre: genreValue,
    rating: asString(getField(rawMovie, ["rating", "viewershipRating", "mpaaRating"]), "Not Rated"),
    runtime: asNumber(getField(rawMovie, ["runtime", "duration"]), 0),
    releaseDate: asString(getField(rawMovie, ["releaseDate", "releasedAt", "release"]), ""),
    createdBy: asString(getField(rawMovie, ["createdBy", "author", "owner"]), "Administrator"),
    averageCriticScore: asNumber(getField(rawMovie, ["averageCriticScore", "averageScore", "averageRating"]), NaN),
  };
}

// Converts raw review payloads into the application's review model (ensures all fields are present and correct)
function normalizeReview(rawReview: Record<string, unknown>, movieId: string): Review {
  const scoreValue = getField(rawReview, ["score", "rating", "criticScore", "criticRating", "stars"]);
  const normalizedScore = asNumber(scoreValue, NaN);
  const criticName = asString(getField(rawReview, ["criticName", "critic", "reviewerName", "createdBy"]), "Anonymous Critic");
  const criticAvatarUrl = asString(
    getField(rawReview, ["criticAvatarUrl", "criticImage", "criticPhoto", "avatar", "profilePicture", "profileImage"]),
    `https://ui-avatars.com/api/?name=${encodeURIComponent(criticName)}&background=fde68a&color=78350f&bold=true`,
  );

  return {
    id: asString(getField(rawReview, ["id", "reviewId", "_id"]), crypto.randomUUID()),
    movieId: asString(getField(rawReview, MOVIE_ID_FIELD_KEYS), movieId),
    title: asString(getField(rawReview, ["title", "reviewTitle", "headline"]), ""),
    criticName,
    criticAvatarUrl,
    score: Number.isFinite(normalizedScore) ? normalizedScore : undefined,
    comment: asString(getField(rawReview, ["comment", "reviewText", "content", "body", "description"]), "No written review available."),
    isPublished: asBoolean(getField(rawReview, ["isPublished", "published", "status"]), true),
    publishedAt: asString(getField(rawReview, ["publishedAt", "publishedDate", "createdAt", "updatedAt"]), ""),
    timePublishedAgo: asString(getField(rawReview, ["timePublishedAgo", "publishedAgo", "timeAgo"]), ""),
  };
}

// Calculates one average critic score from all scored reviews.
function getAverageScore(reviews: Review[]): number {
  const scoredReviews = reviews.filter(
    (review): review is Review & { score: number } => typeof review.score === 'number' && Number.isFinite(review.score),
  );

  if (scoredReviews.length === 0) {
    return 0;
  }

  const total = scoredReviews.reduce((sum, review) => sum + review.score, 0);
  return Number((total/scoredReviews.length).toFixed(1));
}

// Structure for debugging movie reviews A.P.I responses (shows both parsed and raw data)
interface MovieReviewsDebugResult {
  reviews: Review[]
  rawPayload: unknown
  requestedPath: string | null
}

// Performs one H.T.T.P request and returns parsed J.S.O.N or null for empty responses
async function requestJson(path: string): Promise<unknown> {
  const response = await fetch(path);

  if (!response.ok) {
    // If 404 (not found) error then treat as "no reviews" and return empty array with no error and no log)
    if (response.status === 404) {
      return [];
    }
    // For other errors do not log or throw an error just return null (fail silently)
    return null;
  }

  if (response.status === 204) {
    return null;
  }

  const responseText = await response.text();

  if (!responseText.trim()) {
    return null;
  }

  return JSON.parse(responseText) as unknown;
}

// Tries several endpoint options until one works (useful when backend endpoints differ between environments)
async function requestFirstAvailable(paths: string[]): Promise<unknown> {
  let lastError: unknown = null;

  for (const path of paths) {
    try {
      return await requestJson(path);
    } catch (error) {
      lastError = error;
      if (error instanceof ApiResponseError) {
        // Endpoints can differ across environments so keep trying fallbacks
        continue;
      }

      throw error;
    }
  }

  throw lastError ?? new Error("No endpoint returned data.");
}

// Loads all movies and ensures every movie has an average critic score
// Returns a list of Movie objects ready for display
export async function fetchMovies(): Promise<Movie[]> {
  const payload = await requestJson(`${API_BASE_URL}/movies`);
  const rawMovies = getArrayPayload(payload).filter(isRecord);

  const movies = rawMovies.map(normalizeMovie);

  const withAverageScores = await Promise.all(
    movies.map(async (movie) => {
      if (typeof movie.averageCriticScore === 'number' && Number.isFinite(movie.averageCriticScore)) {
        return movie;
      }

      try {
        const reviews = await fetchMovieReviews(movie.id);
        return {
          ...movie,
          averageCriticScore: getAverageScore(reviews),
        };
      } catch {
        return {
          ...movie,
          averageCriticScore: 0,
        };
      }
    }),
  );

  return withAverageScores;
}

// Loads one movie by ID then back-fills average score when the A.P.I does not provide it
export async function fetchMovieById(movieId: string): Promise<Movie> {
  const payload = await requestFirstAvailable([
    `${API_BASE_URL}/movies/${movieId}`,
    `${API_BASE_URL}/movies/details/${movieId}`,
  ]);

  const rawMovie = getObjectPayload(payload);

  if (!rawMovie) {
    throw new Error("Movie not found.");
  }

  const movie = normalizeMovie(rawMovie);

  if (typeof movie.averageCriticScore === 'number' && Number.isFinite(movie.averageCriticScore)) {
    return movie;
  }

  const reviews = await fetchMovieReviews(movieId);
  return {
    ...movie,
    averageCriticScore: getAverageScore(reviews),
  };
}

// Internal review fetch that also returns raw payload details for debugging
// Used by both the main fetch and the debug fetch
async function fetchMovieReviewsInternal(movieId: string): Promise<MovieReviewsDebugResult> {
  const normalizedMovieId = movieId.trim()

  if (!normalizedMovieId) {
    return {
      reviews: [],
      rawPayload: null,
      requestedPath: null,
    };
  }

  const reviewPaths = [
    `${API_BASE_URL}/movies/reviews?movieID=${encodeURIComponent(normalizedMovieId)}`,
    // `${API_BASE_URL}/movies/reviews?movieId=${encodeURIComponent(normalizedMovieId)}`,
    // `${API_BASE_URL}/movies/reviews/${normalizedMovieId}`,
    // `${API_BASE_URL}/movies/${normalizedMovieId}/reviews`,
    // `${API_BASE_URL}/reviews/movie/${normalizedMovieId}`,
    // `${API_BASE_URL}/reviews?movieID=${encodeURIComponent(normalizedMovieId)}`,
    // `${API_BASE_URL}/reviews?movieId=${encodeURIComponent(normalizedMovieId)}`,
    // `${API_BASE_URL}/reviews?id=${encodeURIComponent(normalizedMovieId)}`,
    // `${API_BASE_URL}/reviews/${normalizedMovieId}`,
  ]

  let payload: unknown = null;
  let requestedPath: string | null = null;

  for (const path of reviewPaths) {
    try {
      payload = await requestJson(path);
      requestedPath = path;
      break;
    } catch (error) {
      if (error instanceof ApiResponseError) {
        continue;
      }

      throw error;
    }
  }

  if (!requestedPath) {
    return {
      reviews: [],
      rawPayload: null,
      requestedPath: null,
    };
  }

  const arrayPayload = getArrayPayload(payload).filter(isRecord);
  const singlePayload = getObjectPayload(payload);

  const rawReviews =
    arrayPayload.length > 0
      ? arrayPayload
      : singlePayload && isLikelyReviewRecord(singlePayload)
        ? [singlePayload]
        : [];

  const normalizedReviews = rawReviews.map((rawReview) => ({
    review: normalizeReview(rawReview, movieId),
    hasExplicitMovieId: hasExplicitMovieId(rawReview),
  }));

  const hasAnyExplicitMovieId = normalizedReviews.some((entry) => entry.hasExplicitMovieId);
  const normalizedSelectedMovieId = normalizeId(movieId);

  const relevantReviews = hasAnyExplicitMovieId
    ? normalizedReviews.filter((entry) => normalizeId(entry.review.movieId) === normalizedSelectedMovieId)
    : normalizedReviews;

  return {
    reviews: relevantReviews
      .map((entry) => entry.review)
      .filter((review) => review.isPublished)
      .sort((a, b) => {
        const aDate = Date.parse(a.publishedAt ?? '');
        const bDate = Date.parse(b.publishedAt ?? '');

        if (Number.isNaN(aDate) && Number.isNaN(bDate)) {
          return 0;
        }

        if (Number.isNaN(aDate)) {
          return 1;
        }

        if (Number.isNaN(bDate)) {
          return -1;
        }

        return bDate - aDate;
      }),
    rawPayload: payload,
    requestedPath,
  };
}

// Public review fetch used by the main application
// Returns only the parsed reviews for a given movie
export async function fetchMovieReviews(movieId: string): Promise<Review[]> {
  const result = await fetchMovieReviewsInternal(movieId);
  return result.reviews;
}

// Debug fetch used when the interface needs endpoint and raw payload information
// Returns both the parsed reviews and the raw API response for troubleshooting
export async function fetchMovieReviewsDebug(movieId: string): Promise<MovieReviewsDebugResult> {
  return fetchMovieReviewsInternal(movieId);
}
