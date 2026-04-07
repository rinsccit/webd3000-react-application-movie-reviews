import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode, SyntheticEvent } from "react";
import { Link, Navigate, Route, Routes, useMatch, useParams } from "react-router-dom";
import { fetchMovieById, fetchMovieReviews, fetchMovieReviewsDebug, fetchMovies } from "./services/movieApi";
import type { Movie } from "./types/Movie";
import type { Review } from "./types/Review";

const FAVOURITE_MOVIES_STORAGE_KEY = 'movie-reviews.favourite-movie-ids'

// Reads favourite movie IDs from localStorage and returns a safe normalized list
function loadFavouriteMovieIds(): string[] {
	if (typeof window === 'undefined') {
		return []
	}

	try {
		const storedValue = window.localStorage.getItem(FAVOURITE_MOVIES_STORAGE_KEY)

		if (!storedValue) {
			return []
		}

		const parsedValue = JSON.parse(storedValue) as unknown

		if (!Array.isArray(parsedValue)) {
			return []
		}

		const validIds = parsedValue
			.filter((entry): entry is string => typeof entry === 'string')
			.map((entry) => entry.trim())
			.filter((entry) => entry.length > 0)

		return Array.from(new Set(validIds))
	} catch {
		return []
	}
}

// Saves favourite movie IDs to localStorage so the selection survives page reloads
function saveFavouriteMovieIds(favouriteMovieIds: string[]): void {
	if (typeof window === 'undefined') {
		return
	}

	try {
		window.localStorage.setItem(FAVOURITE_MOVIES_STORAGE_KEY, JSON.stringify(favouriteMovieIds))
	} catch {
		// Ignore storage errors so the rest of the app remains usable.
	}
}

// This helper makes sure user text is treated as plain text and not as a regular-expression command
function escapeRegex(searchTerm: string): string {
	return searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// This helper wraps matching text in a highlighted marker so search matches are easy to spot
function highlightText(text: string, searchTerm: string): ReactNode {
	const normalizedSearchTerm = searchTerm.trim()

	if (!normalizedSearchTerm) {
		return text
	}

	const matcher = new RegExp(`(${escapeRegex(normalizedSearchTerm)})`, 'ig')
	const parts = text.split(matcher)

	return parts.map((part, index) => {
		if (part.toLowerCase() === normalizedSearchTerm.toLowerCase()) {
			return (
				<mark key={`match-${part}-${index}`} className="rounded-md bg-yellow-300 px-1 py-0.5 font-semibold text-slate-950 ring-1 ring-yellow-500/60">
					{part}
				</mark>
			)
		}

		return <span key={`plain-${part}-${index}`}>{part}</span>
	})
}

// Converts runtime in minutes into a human-friendly sentence
function formatRuntime(runtime: number): string {
	if (!runtime || runtime <= 0) {
		return 'Runtime unavailable'
	}

	const hours = Math.floor(runtime/60)
	const minutes = runtime%60

	if (hours === 0) {
		return `${minutes} minutes`
	}

	return `${hours} hours ${minutes} minutes`
}

// Converts A.P.I date values into a readable date format for users
function formatDate(dateValue: string): string {
	const date = new Date(dateValue)

	if (Number.isNaN(date.getTime())) {
		return 'Date unavailable'
	}

	return date.toLocaleDateString(undefined, {
		year: 'numeric',
		month: 'long',
		day: 'numeric',
	})
}

// Applies colour styles to ratings so strong and weak ratings are visually distinct
function scoreTone(score: number): string {
	if (score >= 4) {
		return 'bg-emerald-100 text-emerald-700 ring-emerald-300'
	}

	if (score >= 2.5) {
		return 'bg-amber-100 text-amber-700 ring-amber-300'
	}

	return 'bg-rose-100 text-rose-700 ring-rose-300'
}

// Normalizes critic names so comparisons remain reliable regardless of case or spacing
function normalizeCriticName(criticName: string): string {
	return criticName.trim().toLowerCase()
}

// Returns the critic names (normalized) with the highest review-count, used for the Top Rated tag
function getTopRatedCritics(reviews: Review[]): Set<string> {
	const counts = new Map<string, number>()

	for (const review of reviews) {
		const normalizedName = normalizeCriticName(review.criticName)

		if (!normalizedName) {
			continue
		}

		counts.set(normalizedName, (counts.get(normalizedName) ?? 0) + 1)
	}

	let highestCount = 0

	for (const count of counts.values()) {
		if (count > highestCount) {
			highestCount = count
		}
	}

	if (highestCount <= 1) {
		return new Set<string>()
	}

	const topCritics = new Set<string>()

	for (const [criticName, count] of counts.entries()) {
		if (count === highestCount) {
			topCritics.add(criticName)
		}
	}

	return topCritics
}

// Replaces broken images with a safe placeholder so the layout remains stable
function handleImageFallback(event: SyntheticEvent<HTMLImageElement>): void {
	event.currentTarget.src = 'https://placehold.co/400x600/f1f5f9/334155?text=Poster+Unavailable'
}

// Replaces broken critic avatars with an initials-style placeholder image
function handleCriticAvatarFallback(event: SyntheticEvent<HTMLImageElement>): void {
	event.currentTarget.src = 'https://ui-avatars.com/api/?name=Critic&background=e2e8f0&color=334155&bold=true'
}

interface AppShellProps {
	children: ReactNode
	headerEyebrow?: string
	headerTitle: string
	headerSubtitle: string
	searchInput: string
	searchPlaceholder: string
	onSearchInputChange: (searchValue: string) => void
	onSearchSubmit: () => void
	onSearchClear: () => void
}

// Shared page frame that keeps one consistent header, search bar and footer across routes
function AppShell({
	children,
	headerEyebrow,
	headerTitle,
	headerSubtitle,
	searchInput,
	searchPlaceholder,
	onSearchInputChange,
	onSearchSubmit,
	onSearchClear,
}: AppShellProps) {
	const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		onSearchSubmit()
	}

	return (
		<div className="mx-auto min-h-screen max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
			<header className="fade-up mb-8 rounded-3xl border border-amber-200/70 bg-white/85 px-6 py-6 shadow-lg shadow-amber-100/60 backdrop-blur">
				<div>
					{headerEyebrow ? (
						<p className="text-sm font-semibold uppercase tracking-[0.2em] text-rose-600">{headerEyebrow}</p>
					) : null}
					<h1 className="mt-2 text-4xl leading-tight text-slate-900">{headerTitle}</h1>
					<p className="mt-2 text-slate-600">
						{headerSubtitle}
					</p>
				</div>

				<form className="mt-5 flex w-full flex-col gap-3 sm:flex-row" onSubmit={handleSubmit}>
					<input
						type="search"
						value={searchInput}
						onChange={(event) => onSearchInputChange(event.target.value)}
						placeholder={searchPlaceholder}
						className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none ring-amber-300 transition focus:ring-2"
					/>
					<button
						type="submit"
						className="rounded-xl bg-[#0D6EFD] bg-900 cursor-pointer px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#0A58CA] bg-700"
					>
						Go
					</button>
					<button
						type="button"
						onClick={onSearchClear}
						className="rounded-xl border border-slate-300 cursor-pointer bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-[#6C757D] bg-100 hover:text-white"
					>
						Clear
					</button>
				</form>
			</header>

			{children}

			<footer className="mt-10 pb-4 text-center text-sm text-slate-500">
				Built for WEBD3000 subject (Sprint 4) using React, Tailwind CSS, TypeScript and the C# A.P.I built in the previous sprint.
				</footer>
		</div>
	)
}


interface HomePageProps {
	searchTerm: string
	favouriteMovieIds: string[]
	onToggleFavourite: (movieId: string) => void
}

// Home page: fetches all movies and filters them using the home-page search term
function HomePage({ searchTerm, favouriteMovieIds, onToggleFavourite }: HomePageProps) {
	const moviesPerPage = 6
	const [movies, setMovies] = useState<Movie[]>([])
	const [isLoading, setIsLoading] = useState(true)
	const [errorMessage, setErrorMessage] = useState('')
	const [genreFilter, setGenreFilter] = useState('all')
	const [minimumRatingFilter, setMinimumRatingFilter] = useState('0')
	const [maximumRuntimeFilter, setMaximumRuntimeFilter] = useState('0')
	const [sortFilter, setSortFilter] = useState('default')
	const [currentPage, setCurrentPage] = useState(1)
	const normalizedSearchTerm = searchTerm.trim().toLowerCase()

	// Builds the genre dropdown values from currently loaded movies
	const availableGenres = useMemo(() => {
		const genres = new Set<string>()

		for (const movie of movies) {
			const genreParts = (movie.genre ?? '')
				.split(',')
				.map((genre) => genre.trim())
				.filter(Boolean)

			for (const genre of genreParts) {
				genres.add(genre)
			}
		}

		return Array.from(genres).sort((a, b) => a.localeCompare(b))
	}, [movies])

	// Builds one dedicated list containing only favourited movies
	const favouriteMovies = useMemo(() => {
		const favouriteMovieIdSet = new Set(favouriteMovieIds)
		return movies.filter((movie) => favouriteMovieIdSet.has(movie.id))
	}, [movies, favouriteMovieIds])

	// Applies search + advanced filters first then applies the selected sort order
	const filteredMovies = useMemo(() => {
		const minimumScore = Number(minimumRatingFilter)
		const maximumRuntime = Number(maximumRuntimeFilter)

		const filtered = movies.filter((movie) => {
			const averageScore = movie.averageCriticScore ?? 0
			const runtimeText = formatRuntime(movie.runtime)
			const releaseDateText = formatDate(movie.releaseDate)
			const searchableText = [
				movie.title,
				movie.synopsis,
				movie.genre ?? '',
				averageScore.toString(),
				averageScore.toFixed(1),
				movie.runtime.toString(),
				runtimeText,
				movie.releaseDate,
				releaseDateText,
			].join(' ').toLowerCase()

			const searchMatches = !normalizedSearchTerm || searchableText.includes(normalizedSearchTerm)
			const movieGenres = (movie.genre ?? '')
				.split(',')
				.map((genre) => genre.trim().toLowerCase())
				.filter(Boolean)
			const genreMatches = genreFilter === 'all' || movieGenres.includes(genreFilter.toLowerCase())
			const ratingMatches = averageScore >= minimumScore
			const runtimeMatches = maximumRuntime <= 0 || movie.runtime <= maximumRuntime

			return searchMatches && genreMatches && ratingMatches && runtimeMatches
		})

		if (sortFilter === 'rating-desc') {
			return [...filtered].sort((a, b) => (b.averageCriticScore ?? 0) - (a.averageCriticScore ?? 0))
		}

		if (sortFilter === 'runtime-asc') {
			return [...filtered].sort((a, b) => a.runtime - b.runtime)
		}

		if (sortFilter === 'release-desc') {
			return [...filtered].sort((a, b) => {
				const aDate = Date.parse(a.releaseDate)
				const bDate = Date.parse(b.releaseDate)

				if (Number.isNaN(aDate) && Number.isNaN(bDate)) {
					return 0
				}

				if (Number.isNaN(aDate)) {
					return 1
				}

				if (Number.isNaN(bDate)) {
					return -1
				}

				return bDate - aDate
			})
		}

		if (sortFilter === 'title-asc') {
			return [...filtered].sort((a, b) => a.title.localeCompare(b.title))
		}

		return filtered
	}, [movies, normalizedSearchTerm, genreFilter, minimumRatingFilter, maximumRuntimeFilter, sortFilter])

	const totalPages = useMemo(() => {
		if (filteredMovies.length === 0) {
			return 1
		}

		return Math.ceil(filteredMovies.length / moviesPerPage)
	}, [filteredMovies.length, moviesPerPage])

	const paginatedMovies = useMemo(() => {
		const startIndex = (currentPage - 1) * moviesPerPage
		return filteredMovies.slice(startIndex, startIndex + moviesPerPage)
	}, [filteredMovies, currentPage, moviesPerPage])

	const pageButtons = useMemo(() => {
		return Array.from({ length: totalPages }, (_, index) => index + 1)
	}, [totalPages])

	// Resets only the advanced filters and this does not clear the global search bar input
	const clearAdvancedFilters = () => {
		setGenreFilter('all')
		setMinimumRatingFilter('0')
		setMaximumRuntimeFilter('0')
		setSortFilter('default')
	}

	useEffect(() => {
		setCurrentPage(1)
	}, [normalizedSearchTerm, genreFilter, minimumRatingFilter, maximumRuntimeFilter, sortFilter])

	useEffect(() => {
		setCurrentPage((previousPage) => Math.min(previousPage, totalPages))
	}, [totalPages])

	useEffect(() => {
		let isMounted = true

		const loadMovies = async () => {
			try {
				setIsLoading(true)
				const allMovies = await fetchMovies()

				if (isMounted) {
					setMovies(allMovies)
				}
			} catch {
				if (isMounted) {
					setErrorMessage('Unable to load movies from the A.P.I. Please check your backend server and try again.')
				}
			} finally {
				if (isMounted) {
					setIsLoading(false)
				}
			}
		}

		void loadMovies()

		return () => {
			isMounted = false
		}
	}, [])

	const startMovieNumber = filteredMovies.length === 0 ? 0 : (currentPage - 1) * moviesPerPage + 1
	const endMovieNumber = Math.min(currentPage * moviesPerPage, filteredMovies.length)

	return (
		<section className="fade-up">
			{isLoading ? (
				<div className="rounded-2xl border border-slate-200 bg-white/90 p-8 text-center text-slate-600 shadow-sm">
					Loading movies...
				</div>
			) : null}

			{!isLoading && errorMessage ? (
				<div className="rounded-2xl border border-rose-300 bg-rose-50 p-6 text-rose-700">{errorMessage}</div>
			) : null}

			{!isLoading && !errorMessage ? (
				<div className="space-y-4">
					<div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
						<p className="text-sm font-semibold uppercase tracking-wide text-slate-700">Advanced filters</p>
						<div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
							<select
								value={genreFilter}
								onChange={(event) => setGenreFilter(event.target.value)}
								className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none ring-amber-300 transition focus:ring-2"
							>
								<option value="all">All genres</option>
								{availableGenres.map((genre) => (
									<option key={genre} value={genre}>{genre}</option>
								))}
							</select>

							<select
								value={minimumRatingFilter}
								onChange={(event) => setMinimumRatingFilter(event.target.value)}
								className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none ring-amber-300 transition focus:ring-2"
							>
								<option value="0">Any rating</option>
								<option value="1">1.0+ rating</option>
								<option value="2">2.0+ rating</option>
								<option value="3">3.0+ rating</option>
								<option value="4">4.0+ rating</option>
							</select>

							<select
								value={maximumRuntimeFilter}
								onChange={(event) => setMaximumRuntimeFilter(event.target.value)}
								className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none ring-amber-300 transition focus:ring-2"
							>
								<option value="0">Any runtime</option>
								<option value="90">Up to 90 min</option>
								<option value="120">Up to 120 min</option>
								<option value="150">Up to 150 min</option>
								<option value="180">Up to 180 min</option>
							</select>

							<select
								value={sortFilter}
								onChange={(event) => setSortFilter(event.target.value)}
								className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none ring-amber-300 transition focus:ring-2"
							>
								<option value="default">Default order</option>
								<option value="rating-desc">Highest rating first</option>
								<option value="release-desc">Newest release first</option>
								<option value="runtime-asc">Shortest runtime first</option>
								<option value="title-asc">Title A-Z</option>
							</select>

							<button
								type="button"
								onClick={clearAdvancedFilters}
								className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
							>
								Reset filters
							</button>
						</div>
					</div>

					<article className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
						<div className="flex flex-wrap items-center justify-between gap-2">
							<h3 className="text-lg font-semibold text-slate-900">Favourite Movies</h3>
							<span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-rose-700 ring-1 ring-rose-300">
								{favouriteMovies.length} saved
							</span>
						</div>

						{favouriteMovies.length === 0 ? (
							<p className="mt-3 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
								No favourite movies yet. Click "Add to Favourite" on any movie card to save it here.
							</p>
						) : (
							<div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
								{favouriteMovies.map((movie) => (
									<Link
										key={`favourite-${movie.id}`}
										to={`/movies/${movie.id}`}
										className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 transition hover:border-slate-300 hover:bg-slate-50"
									>
										<img
											src={movie.image}
											alt={`${movie.title} poster`}
											className="h-16 w-12 rounded-md border border-slate-200 object-cover"
											onError={handleImageFallback}
										/>
										<div className="min-w-0">
											<p className="truncate text-sm font-semibold text-slate-900 group-hover:text-slate-950">{movie.title}</p>
											<p className="mt-1 text-xs text-slate-500">{formatRuntime(movie.runtime)}</p>
										</div>
									</Link>
								))}
							</div>
						)}
					</article>

					{filteredMovies.length === 0 ? (
						<div className="rounded-2xl border border-slate-200 bg-white/90 p-8 text-center text-slate-600 shadow-sm">
							No movies matched your search and filters. Try another combination.
						</div>
					) : (
						<>
							<div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
								{paginatedMovies.map((movie, index) => {
						const score = movie.averageCriticScore ?? 0
						const isFavourite = favouriteMovieIds.includes(movie.id)
						const animationIndex = (currentPage - 1) * moviesPerPage + index

						return (
							<article
								key={movie.id}
								className="group fade-up relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white/90 shadow-sm shadow-slate-200/60 transition hover:-translate-y-1 hover:shadow-lg"
								style={{ animationDelay: `${animationIndex * 80}ms` }}
							>
								<button
									type="button"
									onClick={() => onToggleFavourite(movie.id)}
									className={`absolute right-3 top-3 z-10 rounded-full px-3 py-1 text-xs font-semibold ring-1 backdrop-blur transition ${isFavourite ? 'bg-rose-100 text-rose-700 ring-rose-300 hover:bg-rose-200' : 'bg-white/90 text-slate-700 ring-slate-300 hover:bg-slate-100'}`}
								>
									{isFavourite ? 'Added to Favourites' : 'Add to Favourite'}
								</button>

								<Link to={`/movies/${movie.id}`} className="block">
									<div className="relative h-72 overflow-hidden bg-slate-100 sm:h-80">
										<img
											src={movie.image}
											alt={`${movie.title} poster`}
											className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
											onError={handleImageFallback}
										/>
										<div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-900/80 to-transparent p-4">
											<span
												className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${scoreTone(score)}`}
											>
												Critics rating: {score.toFixed(1)}/5
											</span>
										</div>
									</div>

									<div className="space-y-2 px-5 py-4">
										<h2 className="text-xl text-slate-900">{highlightText(movie.title, searchTerm)}</h2>
										<p className="line-clamp-3 text-sm text-slate-600">{highlightText(movie.synopsis, searchTerm)}</p>
									</div>
								</Link>
							</article>
						)
								})}
							</div>

							<div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
								<p className="text-sm text-slate-600">
									Showing {startMovieNumber}-{endMovieNumber} of {filteredMovies.length} movies
								</p>

								<div className="flex flex-wrap items-center gap-2">
									<button
										type="button"
										onClick={() => setCurrentPage((page) => Math.max(page - 1, 1))}
										disabled={currentPage === 1}
										className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 transition enabled:hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
									>
										Previous
									</button>

									{pageButtons.map((pageNumber) => (
										<button
											key={pageNumber}
											type="button"
											onClick={() => setCurrentPage(pageNumber)}
											className={`rounded-lg px-3 py-1.5 text-sm font-semibold ring-1 transition ${currentPage === pageNumber ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-100'}`}
										>
											{pageNumber}
										</button>
									))}

									<button
										type="button"
										onClick={() => setCurrentPage((page) => Math.min(page + 1, totalPages))}
										disabled={currentPage === totalPages}
										className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 transition enabled:hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
									>
										Next
									</button>
								</div>
							</div>
						</>
					)}
				</div>
			) : null}
		</section>
	)
}

interface MovieDetailsPageProps {
	searchTerm: string
	favouriteMovieIds: string[]
	onToggleFavourite: (movieId: string) => void
}

// Movie details webpage: loads one movie and its reviews then highlights matching details-page search text
function MovieDetailsPage({ searchTerm, favouriteMovieIds, onToggleFavourite }: MovieDetailsPageProps) {
	const { movieId } = useParams<{ movieId: string }>()
	const [movie, setMovie] = useState<Movie | null>(null)
	const [reviews, setReviews] = useState<Review[]>([])
	const [topRatedCritics, setTopRatedCritics] = useState<Set<string>>(new Set<string>())
	const [rawReviewsPayload, setRawReviewsPayload] = useState<unknown>(null)
	const [reviewsEndpointUsed, setReviewsEndpointUsed] = useState<string | null>(null)
	const [isLoading, setIsLoading] = useState(true)
	const [errorMessage, setErrorMessage] = useState('')

	useEffect(() => {
		if (!movieId) {
			return
		}

		let isMounted = true

		const loadDetails = async () => {
			try {
				setIsLoading(true)
				const [movieDetails, reviewsDebug] = await Promise.all([
					fetchMovieById(movieId),
					fetchMovieReviewsDebug(movieId),
				])

				if (isMounted) {
					setMovie(movieDetails)
					setReviews(reviewsDebug.reviews)
					setRawReviewsPayload(reviewsDebug.rawPayload)
					setReviewsEndpointUsed(reviewsDebug.requestedPath)
				}
			} catch {
				if (isMounted) {
					setErrorMessage('Unable to load this movie and its reviews from the A.P.I.')
					setRawReviewsPayload(null)
					setReviewsEndpointUsed(null)
				}
			} finally {
				if (isMounted) {
					setIsLoading(false)
				}
			}
		}

		void loadDetails()

		return () => {
			isMounted = false
		}
	}, [movieId])

	// Calculates top rated critics by counting review totals across all movies
	useEffect(() => {
		let isMounted = true

		const loadTopRatedCritics = async () => {
			try {
				const movies = await fetchMovies()
				const reviewResults = await Promise.allSettled(movies.map((movieEntry) => fetchMovieReviews(movieEntry.id)))
				const allReviews: Review[] = []

				for (const result of reviewResults) {
					if (result.status === 'fulfilled') {
						allReviews.push(...result.value)
					}
				}

				if (isMounted) {
					setTopRatedCritics(getTopRatedCritics(allReviews))
				}
			} catch {
				if (isMounted) {
					setTopRatedCritics(new Set<string>())
				}
			}
		}

		void loadTopRatedCritics()

		return () => {
			isMounted = false
		}
	}, [])

	const normalizedReviewSearchTerm = searchTerm.trim().toLowerCase()
	const detailHighlightTerm = searchTerm.trim()

	const filteredReviews = useMemo(() => {
		if (!normalizedReviewSearchTerm) {
			return reviews
		}

		return reviews.filter((review) => {
			const scoreText = typeof review.score === 'number' ? `${review.score} ${review.score.toFixed(1)}` : ''
			const searchableText = [
				review.title ?? '',
				review.criticName,
				review.criticAvatarUrl ?? '',
				review.comment,
				review.publishedAt ?? '',
				review.timePublishedAgo ?? '',
				scoreText,
			].join(' ').toLowerCase()

			return searchableText.includes(normalizedReviewSearchTerm)
		})
	}, [reviews, normalizedReviewSearchTerm])

	const reviewsToDisplay = useMemo(() => {
		if (!normalizedReviewSearchTerm) {
			return reviews
		}

		return filteredReviews.length > 0 ? filteredReviews : reviews
	}, [reviews, filteredReviews, normalizedReviewSearchTerm])

	useEffect(() => {
		if (!movieId) {
			return
		}

		console.log('[MovieReviews Debug]', {
			movieId,
			reviewsEndpointUsed: reviewsEndpointUsed ?? 'No matching endpoint returned data',
			rawReviewsPayload,
		})
	}, [movieId, rawReviewsPayload, reviewsEndpointUsed])

	const averageScore = useMemo(() => {
		if (movie?.averageCriticScore !== undefined) {
			return movie.averageCriticScore
		}

		const scoredReviews = reviews.filter(
			(review): review is Review & { score: number } => typeof review.score === 'number' && Number.isFinite(review.score),
		)

		if (scoredReviews.length === 0) {
			return 0
		}

		const total = scoredReviews.reduce((sum, review) => sum + review.score, 0)
		return Number((total / scoredReviews.length).toFixed(1))
	}, [movie, reviews])

	if (!movieId) {
		return <Navigate to="/" replace />
	}

	return (
		<section className="fade-up space-y-6">
			<Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-slate-900 underline">
				← Back to all movies
			</Link>

			{isLoading ? (
				<div className="rounded-2xl border border-slate-200 bg-white/90 p-8 text-center text-slate-600 shadow-sm">
					Loading movie details...
				</div>
			) : null}

			{!isLoading && errorMessage ? (
				<div className="rounded-2xl border border-rose-300 bg-rose-50 p-6 text-rose-700">{errorMessage}</div>
			) : null}

			{!isLoading && !errorMessage && movie ? (
				<div className="space-y-6">
					<article className="grid overflow-hidden rounded-3xl border border-slate-200 bg-white/95 shadow-lg shadow-slate-200/70 md:grid-cols-[300px_1fr]">
						<div className="bg-slate-100">
							<img
								src={movie.image}
								alt={`${movie.title} poster`}
								className="h-full w-full object-cover"
								onError={handleImageFallback}
							/>
						</div>

						<div className="space-y-5 p-6">
							<div className="flex flex-wrap items-center gap-3">
								<h2 className="text-4xl text-slate-900">{highlightText(movie.title, detailHighlightTerm)}</h2>
								<span className={`rounded-full px-3 py-1 text-sm font-semibold ring-1 ${scoreTone(averageScore)}`}>
									Average rating: {averageScore.toFixed(1)}/5
								</span>
								<button
									type="button"
									onClick={() => onToggleFavourite(movie.id)}
									className={`rounded-full px-3 py-1 text-sm font-semibold ring-1 transition ${favouriteMovieIds.includes(movie.id) ? 'bg-rose-100 text-rose-700 ring-rose-300 hover:bg-rose-200' : 'bg-slate-100 text-slate-700 ring-slate-300 hover:bg-slate-200'}`}
								>
									{favouriteMovieIds.includes(movie.id) ? 'Added to Favourites' : 'Add to Favourite'}
								</button>
							</div>

							<p className="text-slate-700">{highlightText(movie.synopsis, detailHighlightTerm)}</p>

							<dl className="grid grid-cols-1 gap-4 text-sm text-slate-600 sm:grid-cols-2">
								<div className="rounded-xl bg-amber-50 p-4">
									<dt className="font-semibold uppercase tracking-wide text-amber-700">Runtime</dt>
									<dd className="mt-1 text-slate-800">{highlightText(formatRuntime(movie.runtime), detailHighlightTerm)}</dd>
								</div>

								<div className="rounded-xl bg-orange-50 p-4">
									<dt className="font-semibold uppercase tracking-wide text-orange-700">Release Date</dt>
									<dd className="mt-1 text-slate-800">{highlightText(formatDate(movie.releaseDate), detailHighlightTerm)}</dd>
								</div>
							</dl>
						</div>
					</article>

					<article className="rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-md shadow-slate-200/60">
						<h3 className="text-3xl text-slate-900">Published Critic Reviews</h3>

						{reviews.length === 0 ? (
							<p className="mt-4 rounded-xl bg-slate-50 p-4 text-slate-600">
								No published critic reviews are available for this movie yet.
							</p>
						) : (
							<div className="mt-5 space-y-4">
								{reviewsToDisplay.map((review) => {
									const hasScore = typeof review.score === 'number' && Number.isFinite(review.score)
									const isTopRatedCritic = topRatedCritics.has(normalizeCriticName(review.criticName))
									const publishedLabel = review.timePublishedAgo || (review.publishedAt ? formatDate(review.publishedAt) : '')

									return (
										<article
											key={review.id}
											className="rounded-2xl border border-slate-200/90 bg-white px-5 py-4 transition hover:border-slate-300"
										>
											{review.title ? (
												<p className="text-base font-semibold text-slate-900">{highlightText(review.title, detailHighlightTerm)}</p>
											) : null}

											<div className="mt-1 flex flex-wrap items-center justify-between gap-2">
												<div className="flex items-center gap-3">
													<img
														src={review.criticAvatarUrl}
														alt={`${review.criticName} profile`}
														className="h-10 w-10 rounded-full border border-slate-200 object-cover"
														onError={handleCriticAvatarFallback}
													/>
													<p className="text-lg font-semibold text-slate-900">{highlightText(review.criticName, detailHighlightTerm)}</p>
													{isTopRatedCritic ? (
														<span className="rounded-full bg-sky-100 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-sky-700 ring-1 ring-sky-300">
															Top Rated
														</span>
													) : null}
												</div>
												{hasScore ? (
													<span className={`rounded-full px-3 py-1 text-sm font-semibold ring-1 ${scoreTone(review.score ?? 0)}`}>
														{(review.score ?? 0).toFixed(1)} / 5
													</span>
												) : null}
											</div>

											{publishedLabel ? (
												<p className="mt-2 text-xs uppercase tracking-wide text-slate-500">{highlightText(publishedLabel, detailHighlightTerm)}</p>
											) : null}

											<p className="mt-3 text-slate-700">{highlightText(review.comment, detailHighlightTerm)}</p>
										</article>
									)
								})}
							</div>
						)}
					</article>

				</div>
			) : null}
		</section>
	)
}

// Top-level route controller that keeps separate search state for the homepage and each movie details webpage
export default function App() {
	const [homeSearchInput, setHomeSearchInput] = useState('')
	const [homeSearchTerm, setHomeSearchTerm] = useState('')
	const [detailsSearchInput, setDetailsSearchInput] = useState('')
	const [detailsSearchTerm, setDetailsSearchTerm] = useState('')
	const [favouriteMovieIds, setFavouriteMovieIds] = useState<string[]>(() => loadFavouriteMovieIds())

	const movieDetailsMatch = useMatch('/movies/:movieId')
	const movieId = movieDetailsMatch?.params.movieId ?? ''
	const isMovieDetailsRoute = Boolean(movieDetailsMatch)

	useEffect(() => {
		if (!movieId) {
			return
		}

		setDetailsSearchInput('')
		setDetailsSearchTerm('')
	}, [movieId])

	useEffect(() => {
		saveFavouriteMovieIds(favouriteMovieIds)
	}, [favouriteMovieIds])

	const activeSearchInput = isMovieDetailsRoute ? detailsSearchInput : homeSearchInput
	const activeHeaderEyebrow = isMovieDetailsRoute ? '' : 'Find a movie'
	const activeHeaderTitle = isMovieDetailsRoute ? 'Movie Details Search' : 'MovieReviews'
	const activeHeaderSubtitle = isMovieDetailsRoute
		? 'Search this movie details and reviews by title, synopsis, critic or publish date.'
		: 'Explore movies, compare critic ratings and read published reviews in one clean place.'
	const activeSearchPlaceholder = isMovieDetailsRoute
		? "Search this movie details and reviews by title, synopsis, critic, rating or publish date..."
		: "Search by title, synopsis, genre, rating, runtime or release date..."

	const handleSearchInputChange = (value: string) => {
		if (isMovieDetailsRoute) {
			setDetailsSearchInput(value)
			return
		}

		setHomeSearchInput(value)
	}

	const handleSearchSubmit = () => {
		if (isMovieDetailsRoute) {
			setDetailsSearchTerm(detailsSearchInput.trim())
			return
		}

		setHomeSearchTerm(homeSearchInput.trim())
	}

	const handleSearchClear = () => {
		if (isMovieDetailsRoute) {
			setDetailsSearchInput('')
			setDetailsSearchTerm('')
			return
		}

		setHomeSearchInput('')
		setHomeSearchTerm('')
	}

	// Adds/removes one movie ID from the favourites list and keeps order stable.
	const handleToggleFavourite = (movieIdToToggle: string) => {
		setFavouriteMovieIds((currentFavourites) => {
			if (currentFavourites.includes(movieIdToToggle)) {
				return currentFavourites.filter((favouriteMovieId) => favouriteMovieId !== movieIdToToggle)
			}

			return [...currentFavourites, movieIdToToggle]
		})
	}

	return (
		<AppShell
			headerEyebrow={activeHeaderEyebrow}
			headerTitle={activeHeaderTitle}
			headerSubtitle={activeHeaderSubtitle}
			searchInput={activeSearchInput}
			searchPlaceholder={activeSearchPlaceholder}
			onSearchInputChange={handleSearchInputChange}
			onSearchSubmit={handleSearchSubmit}
			onSearchClear={handleSearchClear}
		>
			<Routes>
				<Route
					path="/"
					element={
						<HomePage
							searchTerm={homeSearchTerm}
							favouriteMovieIds={favouriteMovieIds}
							onToggleFavourite={handleToggleFavourite}
						/>
					}
				/>
				<Route
					path="/movies/:movieId"
					element={
						<MovieDetailsPage
							searchTerm={detailsSearchTerm}
							favouriteMovieIds={favouriteMovieIds}
							onToggleFavourite={handleToggleFavourite}
						/>
					}
				/>
				<Route path="*" element={<Navigate to="/" replace />} />
			</Routes>
		</AppShell>
	)
}
