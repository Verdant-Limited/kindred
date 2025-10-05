<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { supabase } from '$lib/supabaseClient';
	import { slide } from 'svelte/transition';

	export let data;

	interface BaseItem {
		id: number;
		title: string;
		category_id?: number;
	}

	interface SongChord {
		id: number;
		chord_format: string;
		chords: string;
		transpose_key: string | null;
		capo_position: number | null;
	}

	interface MediaFile {
		id: number;
		file_type: string;
		file_name: string;
		google_drive_url: string | null;
		direct_link: string | null;
		mime_type: string | null;
		metadata: any;
	}

	interface Tag {
		id: number;
		name: string;
	}

	interface Song extends BaseItem {
		lyrics: string;
		artist?: string | null;
		language_id?: number | null;
		source_id?: number | null;
		chords?: SongChord[];
		media?: MediaFile[];
		tags?: Tag[];
	}

	interface Prayer extends BaseItem {
		content: string;
		author?: string | null;
	}

	interface Category {
		id: number;
		name: string;
	}

	type QueueItem = Song | Prayer;

	// Add error type
	type ErrorType = string | null;

	// Add these type definitions at the top of the script
	interface QueueOperations<T extends QueueItem> {
		addToQueue: (item: T) => void;
		removeFromQueue: (index: number) => void;
	}

	interface LoadingState {
		isLoading: boolean;
		error: ErrorType;
	}

	let loadingState: LoadingState = {
		isLoading: false,
		error: null
	};

	// State management
	let showSearch = false;
	let showLyrics = false;
	let searchQuery = '';
	let songs: Song[] = [];
	let prayers: Prayer[] = [];
	let categories: Category[] = [];
	let queue: QueueItem[] = [];
	let lyrics = '';
	let currentSong = '';
	let currentAuthor: string = '';
	let isLoading = false;
	let error: ErrorType = null;

	// New state for hierarchical navigation
	let selectedCategoryId: number | null = null;
	let currentView: 'categories' | 'items' = 'categories';
	let selectedCategoryName = '';

	// Add program code from the route
	$: programCode = data.room.id; // using room id as the program code

	// Subscribe to real-time queue changes
	let queueSubscription: any;

	// Search state
	let searchResults: { id: number; title: string; type: 'song' | 'prayer'; rank: number }[] = [];
	let searching = false;
	let searchError: string | null = null;
	let searchMode: 'categories' | 'results' = 'categories';
	let searchTimeout: ReturnType<typeof setTimeout> | null = null;

	onMount(async () => {
		try {
			isLoading = true;

			// Load Songs, Prayers, Categories, and Queue in parallel
			const [songsResponse, prayersResponse, categoriesResponse, queueResponse] = await Promise.all(
				[
					supabase.from('songs').select(`
						id,
						title,
						lyrics,
						category_id
					`),

					supabase.from('prayers').select(`
						id,
						title,
						content,
						author,
						category_id
					`),

					supabase.from('categories').select(`
						id,
						name
					`),

					// Load existing queue for this program
					supabase
						.from('program_queue')
						.select('*')
						.eq('program_code', programCode)
						.order('position', { ascending: true })
				]
			);

			// Handle Songs
			if (songsResponse.error) {
				console.error('Supabase songs error:', songsResponse.error);
				throw songsResponse.error;
			}
			songs = songsResponse.data || [];
			console.log('✅ Songs loaded:', songs.length);

			// Handle Prayers
			if (prayersResponse.error) {
				console.error('Supabase prayers error:', prayersResponse.error);
				throw prayersResponse.error;
			}
			prayers = prayersResponse.data || [];
			console.log('✅ Prayers loaded:', prayers.length);

			// Handle Categories
			if (categoriesResponse.error) {
				console.error('Supabase categories error:', categoriesResponse.error);
				throw categoriesResponse.error;
			}
			categories = categoriesResponse.data || [];
			console.log('✅ Categories loaded:', categories.length);

			// Handle Queue
			if (queueResponse.error) {
				console.error('Supabase queue error:', queueResponse.error);
				throw queueResponse.error;
			}

			// Reconstruct queue items from database
			queue = await reconstructQueueItems(queueResponse.data || []);
			console.log('✅ Queue loaded:', queue.length);

			// Set up real-time subscription for queue changes
			queueSubscription = supabase
				.channel(`program_queue_${programCode}`)
				.on(
					'postgres_changes',
					{
						event: '*',
						schema: 'public',
						table: 'program_queue',
						filter: `program_code=eq.${programCode}`
					},
					async (payload) => {
						console.log('Queue change detected:', payload);
						await loadQueue();
					}
				)
				.subscribe();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load data';
			console.error('❌ Error:', error);
		} finally {
			isLoading = false;
		}
	});

	// Cleanup subscription when component is destroyed
	onDestroy(() => {
		if (queueSubscription) {
			supabase.removeChannel(queueSubscription);
		}
	});

	// Function to reconstruct queue items from database records
	async function reconstructQueueItems(queueRecords: any[]): Promise<QueueItem[]> {
		const reconstructed: QueueItem[] = [];

		for (const record of queueRecords) {
			let item: QueueItem | null = null;

			if (record.item_type === 'song') {
				item = songs.find((s) => s.id === record.item_id) || null;
			} else if (record.item_type === 'prayer') {
				item = prayers.find((p) => p.id === record.item_id) || null;
			}

			if (item) {
				reconstructed.push(item);
			}
		}

		return reconstructed;
	}

	// Function to reload queue from database
	async function loadQueue() {
		try {
			const { data: queueData, error: queueError } = await supabase
				.from('program_queue')
				.select('*')
				.eq('program_code', programCode)
				.order('position', { ascending: true });

			if (queueError) {
				console.error('Error loading queue:', queueError);
				return;
			}

			queue = await reconstructQueueItems(queueData || []);
		} catch (e) {
			console.error('Error reloading queue:', e);
		}
	}

	// Updated queue operations to use database
	const queueOperations: QueueOperations<QueueItem> = {
		addToQueue: async (item) => {
			try {
				// Check if item is already in queue
				const { data: existingItems, error: checkError } = await supabase
					.from('program_queue')
					.select('id')
					.eq('program_code', programCode)
					.eq('item_id', item.id)
					.eq('item_type', 'lyrics' in item ? 'song' : 'prayer');

				if (checkError) {
					console.error('Error checking existing queue items:', checkError);
					return;
				}

				if (existingItems && existingItems.length > 0) {
					console.log('Item already in queue');
					return;
				}

				// Get the next position
				const { data: maxPositionData, error: maxError } = await supabase
					.from('program_queue')
					.select('position')
					.eq('program_code', programCode)
					.order('position', { ascending: false })
					.limit(1);

				if (maxError) {
					console.error('Error getting max position:', maxError);
					return;
				}

				const nextPosition =
					maxPositionData && maxPositionData.length > 0 ? maxPositionData[0].position + 1 : 0;

				// Add to database
				const { error: insertError } = await supabase.from('program_queue').insert({
					program_code: programCode,
					item_id: item.id,
					item_type: 'lyrics' in item ? 'song' : 'prayer',
					title: item.title,
					position: nextPosition
				});

				if (insertError) {
					console.error('Error adding to queue:', insertError);
				} else {
					console.log('✅ Item added to queue:', item.title);
					incrementStat(item, 'use');
				}
			} catch (e) {
				console.error('Error in addToQueue:', e);
			}
		},

		removeFromQueue: async (index) => {
			try {
				if (index < 0 || index >= queue.length) return;

				const itemToRemove = queue[index];

				// Remove from database
				const { error: deleteError } = await supabase
					.from('program_queue')
					.delete()
					.eq('program_code', programCode)
					.eq('item_id', itemToRemove.id)
					.eq('item_type', 'lyrics' in itemToRemove ? 'song' : 'prayer');

				if (deleteError) {
					console.error('Error removing from queue:', deleteError);
					return;
				}

				// Update positions for remaining items
				const { error: updateError } = await supabase.rpc('update_queue_positions', {
					program_code_param: programCode,
					removed_position: index
				});

				if (updateError) {
					console.error('Error updating positions:', updateError);
				}

				// Clear lyrics if we removed the currently displayed item
				if (itemToRemove.title === currentSong) {
					lyrics = '';
					currentSong = '';
					currentAuthor = '';
				}

				console.log('✅ Item removed from queue:', itemToRemove.title);
			} catch (e) {
				console.error('Error in removeFromQueue:', e);
			}
		}
	};

	function filterCategories(categories: Category[], query: string): Category[] {
		if (!query?.trim()) return categories;
		const searchTerm = query.toLowerCase().trim();
		return categories.filter((category) => category.name.toLowerCase().includes(searchTerm));
	}

	function filterItems(items: QueueItem[], query: string): QueueItem[] {
		if (!query?.trim()) return items;
		const searchTerm = query.toLowerCase().trim();
		return items.filter((item) => item.title.toLowerCase().includes(searchTerm));
	}

	function getContent(item: QueueItem): string {
		return 'lyrics' in item ? item.lyrics : item.content;
	}

	async function fetchContent(item: QueueItem) {
		if ('lyrics' in item && (item.chords == null || item.media == null)) {
			await fetchSongComplete(item as Song);
			currentAuthor = '';
		} else {
			currentAuthor = (item as Prayer).author ?? '';
		}
		lyrics = getContent(item);
		currentSong = item.title;
		showLyrics = true;
		incrementStat(item, 'view');
	}

	async function fetchLyrics(song: Song) {
		lyrics = song.lyrics;
		currentSong = song.title;
		showLyrics = true;
	}

	function selectCategory(category: Category) {
		selectedCategoryId = category.id;
		selectedCategoryName = category.name;
		currentView = 'items';
		searchQuery = ''; // Clear search when entering category
	}

	function goBackToCategories() {
		currentView = 'categories';
		selectedCategoryId = null;
		selectedCategoryName = '';
		searchQuery = ''; // Clear search when going back
	}

	function openSearch() {
		showSearch = true;
		searchMode = 'categories';
		currentView = 'categories';
		selectedCategoryId = null;
		selectedCategoryName = '';
		searchQuery = '';
	}

	// Reactive statements
	$: filteredCategories = filterCategories(categories, searchQuery);
	$: categoryItems = selectedCategoryId
		? [...songs, ...prayers].filter((item) => item.category_id === selectedCategoryId)
		: [];
	$: filteredCategoryItems = filterItems(categoryItems, searchQuery);
	$: currentSongDisplay = queue[0]?.title || '';

	$: if (showLyrics && queue.length > 0) {
		const firstItem = queue[0];
		if (currentSong !== firstItem.title) {
			lyrics = getContent(firstItem);
			currentSong = firstItem.title;
			currentAuthor = 'lyrics' in firstItem ? '' : ((firstItem as Prayer).author ?? '');
		}
	}

	// Debounced full‑text search (Supabase RPC)
	async function runSearch(query: string) {
		if (query.trim().length < 2) {
			searchResults = [];
			searchError = null;
			return;
		}
		searching = true;
		searchError = null;
		try {
			const { data, error } = await supabase.rpc('search_content', {
				search_query: query,
				content_type: 'all',
				limit_count: 40
			});
			if (error) throw error;
			searchResults = data ?? [];
			searchMode = 'results';
		} catch (e) {
			searchError = e instanceof Error ? e.message : 'Search failed';
		} finally {
			searching = false;
		}
	}

	// Watch searchQuery when modal open
	$: if (showSearch) {
		if (searchTimeout) clearTimeout(searchTimeout);
		searchTimeout = setTimeout(() => runSearch(searchQuery), 250);
	}

	// Increment stats (view/use)
	async function incrementStat(item: QueueItem, action: 'view' | 'use') {
		try {
			const content_type = 'lyrics' in item ? 'song' : 'prayer';
			await supabase.rpc('update_content_stats', {
				p_content_type: content_type,
				p_content_id: item.id,
				p_action: action
			});
		} catch (e) {
			console.warn('Stat update failed', e);
		}
	}

	// Fetch full song (lazy) for chords/media/tags
	async function fetchSongComplete(song: Song) {
		try {
			const { data, error } = await supabase.rpc('get_song_complete', {
				song_id_param: song.id
			});
			if (error) throw error;
			if (data) {
				const enriched = data.song;
				song.chords = data.chords || [];
				song.media = data.media || [];
				song.tags = data.tags || [];
				// merge any extra fields if needed
				Object.assign(song, enriched);
			}
		} catch (e) {
			console.error('Failed to load full song', e);
		}
	}
</script>

<!-- Header -->
<div class="flex items-center justify-between px-3 py-4">
	<h1 class="pt-6 pl-6 font-sans text-xl font-semibold tracking-widest text-black">KINDLED</h1>
	<button class="material-symbols-outlined share cursor-pointer pt-6 pr-6" aria-label="Share">
		share
	</button>
</div>

<!-- Loading State -->
{#if isLoading}
	<div class="mt-10 flex items-center justify-center">
		<p class="font-sans text-lg text-gray-600">Loading content...</p>
	</div>
{/if}

<!-- Error State -->
{#if error}
	<div class="mt-10 flex items-center justify-center">
		<p class="font-sans text-lg text-red-600">Error: {error}</p>
	</div>
{/if}

<!-- Search Input -->
<div class="mt-2 flex flex-col items-center justify-center">
	<div class="relative w-80">
		<input
			on:click={openSearch}
			type="text"
			maxlength="20"
			placeholder="Search for Prayer or Song..."
			class="h-15 w-full rounded-[20px] bg-stone-300 pl-10 font-sans text-gray-400 shadow-[0_4px_4px_0_rgba(0,0,0,0.25)] hover:bg-stone-200" />
		<span
			class="material-symbols-outlined flame absolute top-1/2 left-1 -translate-y-1/2 transform text-[#ff7f50]">
			local_fire_department
		</span>
	</div>
	<h2 class="mt-20 text-center font-sans text-[30px] leading-tight font-bold tracking-wide">
		{data.room.title}<br />
	</h2>
	<p class="mt-30 font-sans font-semibold">LYRICS</p>
	<div class="mt-4 flex items-center justify-center">
		<button
			class="material-symbols-outlined arrow flex h-7 w-12 cursor-pointer items-center justify-center rounded-[10px] bg-white pb-8 text-center text-orange-400 shadow-[0_4px_4px_0_rgba(0,0,0,0.25)] hover:bg-gray-200"
			disabled={queue.length === 0}
			on:click={() => {
				if (queue.length > 0) {
					const firstItem = queue[0];
					lyrics = getContent(firstItem);
					currentSong = firstItem.title;
					showLyrics = true;
				}
			}}>
			keyboard_arrow_up
		</button>
	</div>
</div>

<!-- Queue Section -->
<section class="mt-10 px-20 py-4">
	<div class="flex items-center justify-between">
		<h2 class="font-sans text-[10px] font-bold tracking-wide">QUEUED</h2>
		<span class="mr-39 h-6 w-6 rounded-full bg-white pl-1.5 font-semibold">
			{queue.length}
		</span>
		<button
			on:click={openSearch}
			class="material-symbols-outlined add mb-1 h-7 w-10 cursor-pointer rounded-[20px]
                   bg-gray-300 shadow-[0_4px_4px_0_rgba(0,0,0,0.25)] hover:bg-white"
			aria-label="Add song">
			add
		</button>
	</div>

	<!-- Queue List with Scrolling -->
	<div class="queue-container mt-4">
		<ul class="queue-list">
			{#each queue as item, i}
				<li class="queue-item" style="opacity: {1 - i * 0.1};">
					<div class="flex flex-col">
						<span>{item.title}</span>
						{#if !('lyrics' in item) && (item as Prayer).author}
							<span class="queue-author">{(item as Prayer).author}</span>
						{/if}
					</div>
					<button
						on:click={() => queueOperations.removeFromQueue(i)}
						class="close material-symbols-outlined text-[#ff7f50] hover:text-orange-600"
						aria-label="Remove from queue">
						close
					</button>
				</li>
			{/each}
		</ul>
		{#if queue.length === 0}
			<p class="py-8 text-center text-sm text-gray-500">No songs in queue</p>
		{/if}
	</div>
</section>

<!--Share Modal-->

<!-- Search Modal -->
{#if showSearch}
	<div
		class="fixed inset-0 z-10 flex items-end justify-center px-4"
		in:slide|local={{ duration: 300 }}
		out:slide|local={{ duration: 200 }}>
		<div class="h-[90%] w-full max-w-md rounded-t-[30px] bg-stone-300">
			<!-- Header with close button -->
			<div class="mt-6 flex flex-col items-center justify-center px-4">
				<button
					class="material-symbols-outlined slide cursor-pointer text-white"
					on:click={() => (showSearch = false)}>remove</button>

				<!-- Search Input -->
				<div class="relative mt-4 w-full max-w-80">
					<input
						bind:value={searchQuery}
						type="text"
						maxlength="20"
						placeholder={currentView === 'categories' ? 'Search categories...' : 'Search items...'}
						class="h-[60px] w-full rounded-[20px] bg-white pl-10 font-sans text-gray-400 shadow-[0_4px_4px_0_rgba(0,0,0,0.25)] hover:bg-stone-200" />
					<span
						class="material-symbols-outlined flame absolute top-1/2 left-1 -translate-y-1/2 transform text-[#ff7f50]">
						local_fire_department
					</span>
				</div>
			</div>

			<!-- Navigation Header -->
			<div class="mt-6 mb-5 flex items-center justify-center px-4">
				{#if currentView === 'items'}
					<button
						on:click={goBackToCategories}
						class="material-symbols-outlined mr-2 cursor-pointer text-black hover:text-gray-600">
						arrow_back
					</button>
				{/if}
				<h2
					class="text-center font-sans text-[18px] font-medium tracking-wide text-black underline">
					{currentView === 'categories' ? 'CATEGORIES' : selectedCategoryName.toUpperCase()}
				</h2>
			</div>

			<!-- Switch between categories/items and full-text results -->
			{#if searchMode === 'results'}
				<div class="mt-4 px-4">
					{#if searching}
						<p class="text-sm text-gray-600">Searching…</p>
					{:else if searchError}
						<p class="text-sm text-red-500">Search error: {searchError}</p>
					{:else if searchResults.length === 0 && searchQuery.trim().length >= 2}
						<p class="text-sm text-gray-600">No matches found.</p>
					{/if}
				</div>
				<ul
					class="flex flex-col items-center space-y-3 overflow-y-auto px-4 pb-6"
					style="max-height: calc(100% - 230px);">
					{#each searchResults as r}
						<li class="w-full max-w-[360px]">
							<button
								type="button"
								class="flex w-full items-center justify-between rounded-[20px] bg-white px-6 py-3 font-sans shadow-[0_4px_4px_rgba(0,0,0,0.25)] hover:bg-stone-200"
								on:click={() => {
									const item = (r.type === 'song' ? songs : prayers).find((x) => x.id === r.id);
									if (item) fetchContent(item);
								}}>
								<span class="text-left">
									<span class="block font-semibold">{r.title}</span>
									<span class="block text-xs text-gray-500 capitalize">{r.type}</span>
								</span>
								<span class="text-xs text-gray-400">Rank {r.rank.toFixed(2)}</span>
							</button>
						</li>
					{/each}
				</ul>
			{:else}
				<!-- existing categories/items UI unchanged -->
				{#if currentView === 'categories'}
					<!-- Categories List -->
					{#if filteredCategories.length > 0}
						<ul
							class="flex w-full flex-col items-center justify-start space-y-3 overflow-y-auto pb-4"
							style="max-height: 100%; scroll-behavior: smooth;">
							{#each filteredCategories as category}
								<li class="flex w-full items-center justify-center">
									<button
										type="button"
										class="flex h-[60px] w-full max-w-[360px] items-center justify-between rounded-[20px] bg-white px-6 font-sans font-medium shadow-[0_4px_4px_0_rgba(0,0,0,0.25)] hover:bg-stone-200"
										on:click={() => selectCategory(category)}>
										<span class="font-semibold">{category.name}</span>
										<span class="material-symbols-outlined text-gray-400"> chevron_right </span>
									</button>
								</li>
							{/each}
						</ul>
					{:else}
						<p class="mt-4 text-center text-sm text-gray-600">No matching categories found.</p>
					{/if}
				{:else if currentView === 'items'}
					<!-- Songs and Prayers List for Selected Category -->
					{#if filteredCategoryItems.length > 0}
						<ul
							class="flex w-full flex-col items-center justify-center space-y-3 overflow-y-auto pb-4"
							style="max-height: 100%; scroll-behavior: smooth;">
							{#each filteredCategoryItems as item}
								<li
									class="flex h-[70px] w-full max-w-[360px] cursor-pointer items-center justify-between rounded-[20px] bg-white px-6 font-sans shadow-[0_4px_4px_0_rgba(0,0,0,0.25)] hover:bg-stone-200">
									<div class="flex flex-col">
										<span class="font-semibold">{item.title}</span>
										<span class="text-xs font-normal text-gray-500">
											{'lyrics' in item ? 'Song' : 'Prayer'}
										</span>
										{#if !('lyrics' in item) && (item as Prayer).author}
											<span class="author-line">{(item as Prayer).author}</span>
										{/if}
									</div>
									<div class="flex items-center space-x-2">
										<button
											on:click={() => fetchContent(item)}
											class="material-symbols-outlined eye cursor-pointer rounded-full bg-gray-100 p-2 text-black hover:bg-gray-200"
											title="View content">
											visibility
										</button>
										<button
											on:click={() => queueOperations.addToQueue(item)}
											class="material-symbols-outlined plus cursor-pointer rounded-full bg-[#ff7f50] p-2 text-white hover:bg-orange-600"
											title="Add to queue">
											add
										</button>
									</div>
								</li>
							{/each}
						</ul>
					{:else}
						<div class="mt-8 text-center">
							<p class="text-sm text-gray-600">No songs or prayers found in this category.</p>
							<button
								on:click={goBackToCategories}
								class="mt-4 rounded-lg bg-gray-500 px-4 py-2 font-sans text-white hover:bg-gray-600">
								Back to Categories
							</button>
						</div>
					{/if}
				{/if}
			{/if}
		</div>
	</div>
{/if}
<!-- Lyrics Modal -->
{#if showLyrics}
	<div
		class="fixed inset-0 z-10 flex items-end justify-center px-4"
		in:slide|local={{ duration: 300 }}
		out:slide|local={{ duration: 200 }}>
		<div class="h-[90%] w-full max-w-md rounded-t-[30px] bg-white">
			<div class="flex flex-col items-center justify-center">
				<button
					on:click={() => (showLyrics = false)}
					class="material-symbols-outlined slide cursor-pointer text-[#ff7f50]">remove</button>
			</div>
			<h1 class="flex justify-center text-center font-sans font-bold text-[#ff7f50]">
				{'lyrics' in (queue.find((item) => item.title === currentSong) ?? {}) ||
				lyrics.includes('\n\n')
					? 'Lyrics'
					: 'Prayer'}
			</h1>
			<div
				class="overflow-y-auto p-4 text-center font-sans text-sm font-medium whitespace-pre-line text-[#ff7f50]"
				style="max-height: 70%; width: 90%; margin: auto;">
				{lyrics}
				{#if currentAuthor}
					<p class="author-line-modal after-content font-bold">{currentAuthor}</p>
				{/if}
			</div>
			<div class="flex items-center justify-center">
				<div
					class="fixed bottom-5 left-1/2 flex h-15 w-90 -translate-x-1/2 transform items-center justify-center rounded-[20px] bg-white text-center font-sans text-2xl font-bold text-[#ff7f50] shadow-[0_4px_4px_0_rgba(0,0,0,0.25)]">
					{currentSong}
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	/* Use CSS custom properties for consistent sizing */
	:root {
		--icon-size-sm: 25px;
		--icon-size-md: 30px;
		--icon-size-lg: 35px;
		--icon-size-xl: 40px;
	}

	.material-symbols-outlined {
		font-variation-settings:
			'FILL' 0,
			'wght' 400,
			'GRAD' 0,
			'opsz' 24;
	}

	.flame {
		font-size: var(--icon-size-lg);
		font-variation-settings:
			'FILL' 1,
			'wght' 600,
			'GRAD' 0,
			'opsz' 24;
		filter: drop-shadow(0 0 8px rgba(255, 127, 80, 0.6))
			drop-shadow(0 0 16px rgba(255, 127, 80, 0.4)) drop-shadow(0 0 24px rgba(255, 127, 80, 0.2));
		transition: all 0.3s ease;
		animation: flameGlow 2s ease-in-out infinite alternate;
	}

	.flame:hover {
		transform: scale(1.15);
		filter: drop-shadow(0 0 12px rgba(255, 80, 80, 0.8))
			drop-shadow(0 0 24px rgba(255, 127, 80, 0.6)) drop-shadow(0 0 36px rgba(255, 127, 80, 0.4));
	}

	@keyframes flameGlow {
		0% {
			filter: drop-shadow(0 0 8px rgba(255, 127, 80, 0.6))
				drop-shadow(0 0 16px rgba(255, 127, 80, 0.4)) drop-shadow(0 0 24px rgba(255, 127, 80, 0.2));
		}
		100% {
			filter: drop-shadow(0 0 12px rgba(255, 127, 80, 0.8))
				drop-shadow(0 0 20px rgba(255, 127, 80, 0.5)) drop-shadow(0 0 28px rgba(255, 127, 80, 0.3));
		}
	}

	.arrow {
		font-size: var(--icon-size-lg);
	}
	.share {
		font-size: var(--icon-size-sm);
	}
	.add {
		font-size: var(--icon-size-md);
	}
	.slide {
		font-size: var(--icon-size-xl);
	}
	.plus {
		font-size: var(--icon-size-lg);
	}
	.close {
		font-size: var(--icon-size-md);
	}

	/* Fix scrollbar styling */
	.queue-container {
		max-height: 300px; /* Adjust this value based on your needs */
		overflow-y: auto;
		padding-right: 4px; /* Space for scrollbar */
		scrollbar-width: thin;
		scrollbar-color: #ff7f50 transparent;
	}

	.queue-container::-webkit-scrollbar {
		width: 8px;
	}

	.queue-container::-webkit-scrollbar-track {
		background: transparent;
		border-radius: 4px;
	}

	.queue-container::-webkit-scrollbar-thumb {
		background-color: #ff7f50;
		border-radius: 4px;
		border: 1px solid transparent;
		background-clip: content-box;
	}

	.queue-container::-webkit-scrollbar-thumb:hover {
		background-color: #e6632d;
	}

	.queue-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 0;
		margin: 0;
		list-style: none;
	}

	.queue-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 12px 16px;
		background: white;
		border-radius: 12px;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
		transition:
			transform 0.2s ease,
			box-shadow 0.2s ease;
	}

	.queue-item:hover {
		transform: translateY(-1px);
		box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
	}

	.queue-item span {
		font-size: 14px;
		font-weight: 500;
		color: #333;
		max-width: 200px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.author-line,
	.queue-author,
	.author-line-modal {
		font-size: 11px;
		line-height: 1.1;
		color: #6b7280; /* gray-500 */
		font-style: italic;
		margin-top: 2px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 210px;
	}

	.queue-author {
		font-size: 10px;
		color: #ff7f50;
	}

	.author-line-modal {
		text-align: right; /* right aligned "off centered" attribution */
		margin-top: 12px;
		font-size: 0.75rem;
		line-height: 1.1;
		color: #ff7f50; /* same color as content text */
		font-style: italic;
		opacity: 0.9;
		padding-right: 4px;
	}

	.author-line-modal.after-content {
		display: block;
	}

	/* (Optional) Slight fade-in */
	.author-line-modal {
		animation: fadeAuthor 0.35s ease;
	}

	@keyframes fadeAuthor {
		from {
			opacity: 0;
			transform: translateY(4px);
		}
		to {
			opacity: 0.9;
			transform: translateY(0);
		}
	}
</style>
