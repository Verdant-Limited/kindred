<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte';
	import { supabase } from '$lib/config/supabaseClient';
	import { slide, fade } from 'svelte/transition';
	// QR code lib will be dynamically imported on client only

	let { data } = $props();

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
		metadata: Record<string, unknown> | null;
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

	// State management
	let showSearch = $state(false);
	let showLyrics = $state(false);
	let searchQuery = $state('');
	let songs: Song[] = $state([]);
	let prayers: Prayer[] = $state([]);
	let categories: Category[] = $state([]);
	let queue: QueueItem[] = $state([]);
	let lyrics = $state('');
	let currentSong = $state('');
	let currentAuthor = $state('');
	let currentItemType: 'song' | 'prayer' = $state('song');
	let isLoading = $state(false);
	let error: ErrorType = $state(null);
	// When true, keep lyrics modal synced to the first queue item (arrow button). When false, respect manual view selection (e.g., prayers).
	let syncLyricsToQueue = $state(false);

	// Share UI state
	let showShare = $state(false);
	let qrSrc = $state('');
	let shareUrl = $state('');

	async function openShare() {
		try {
			showShare = true;
			await tick();
			// Build a shareable URL to this lobby
			if (typeof window !== 'undefined') {
				shareUrl = `${window.location.origin}/lobby/${programCode}`;
				const QR = await import('qrcode');
				qrSrc = await QR.toDataURL(shareUrl, {
					width: 160,
					margin: 1,
					color: { dark: '#000000', light: '#FFFFFF' }
				});
			}
		} catch (e) {
			console.warn('Failed generating QR', e);
			qrSrc = '';
		}
	}

	async function copyCode() {
		try {
			await navigator.clipboard.writeText(String(programCode));
		} catch (e) {
			console.warn('Copy failed', e);
		}
	}

	// New state for hierarchical navigation
	let selectedCategoryId: number | null = $state(null);
	let currentView: 'categories' | 'items' = $state('categories');
	let selectedCategoryName = $state('');

	// Add program code from the route
	const programCode = $derived(data.room.id); // using room id as the program code

	// Subscribe to real-time queue changes
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let queueSubscription: any;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let categoriesSubscription: any;
	let categoriesRefreshInterval: ReturnType<typeof setInterval> | null = null;
	let queuePollingInterval: ReturnType<typeof setInterval> | null = null;

	// Search/browse state
	let contentTab: 'songs' | 'prayers' = $state('songs');
	let searchInputEl: HTMLInputElement | null = $state(null);

	// Success notification state
	let showSuccessMessage = $state(false);
	let successMessageTimeout: ReturnType<typeof setTimeout> | null = null;

	// Error notification state
	let showErrorMessage = $state(false);
	let errorMessage = $state('');
	let errorMessageTimeout: ReturnType<typeof setTimeout> | null = null;

	function showError(message: string) {
		errorMessage = message;
		showErrorMessage = true;
		if (errorMessageTimeout) clearTimeout(errorMessageTimeout);
		errorMessageTimeout = setTimeout(() => {
			showErrorMessage = false;
		}, 3000);
	}

	// Confirmation dialog state
	let showConfirmation = $state(false);
	let confirmationMessage = $state('');
	let confirmationAction: (() => void) | null = $state(null);

	function showConfirmDialog(message: string, action: () => void) {
		confirmationMessage = message;
		confirmationAction = action;
		showConfirmation = true;
	}

	function cancelConfirmation() {
		showConfirmation = false;
		confirmationAction = null;
	}

	function executeConfirmation() {
		if (confirmationAction) {
			confirmationAction();
		}
		showConfirmation = false;
		confirmationAction = null;
	}

	// Real-time sync loading state
	let isSyncingQueue = $state(false);
	let syncTimeout: ReturnType<typeof setTimeout> | null = null;

	function setSyncing() {
		isSyncingQueue = true;
		if (syncTimeout) clearTimeout(syncTimeout);
		syncTimeout = setTimeout(() => {
			isSyncingQueue = false;
		}, 500);
	}

	// Analytics tracking for popular content
	async function trackContentInteraction(
		contentId: number,
		contentType: 'song' | 'prayer',
		action: string
	) {
		try {
			// This logs interactions without blocking UI
			const { error } = await supabase.rpc('log_content_interaction', {
				content_id_param: contentId,
				content_type_param: contentType,
				action_param: action,
				timestamp_param: new Date().toISOString()
			});
			// Silently fail - analytics shouldn't break the UX
			if (error) {
				console.warn('Analytics tracking failed:', error);
			}
		} catch {
			// Analytics failure doesn't impact user experience
		}
	}

	// Drag state
	let dragStartY = 0;
	let dragDeltaY = $state(0);
	let dragging = $state(false);
	let activePointerId: number | null = null;
	let searchSheetEl: HTMLDivElement | null = $state(null);
	let dragHandleEl: HTMLDivElement | null = $state(null);
	const CLOSE_DRAG_PX = 120;

	function handleDragStart(e: PointerEvent) {
		// Only start dragging if the pointer started on the drag handle
		if (!dragHandleEl || !e.composedPath().includes(dragHandleEl)) {
			return;
		}

		activePointerId = e.pointerId;
		dragging = true;
		dragStartY = e.clientY;
		dragDeltaY = 0;

		// Capture pointer events on the handle element
		if (dragHandleEl) {
			dragHandleEl.setPointerCapture(e.pointerId);
		}
	}

	function handleDragMove(e: PointerEvent) {
		if (!dragging || e.pointerId !== activePointerId) return;
		e.preventDefault(); // Prevent scrolling during drag
		dragDeltaY = Math.max(0, e.clientY - dragStartY);
	}

	function handleDragEnd(e: PointerEvent) {
		if (!dragging || e.pointerId !== activePointerId) return;
		dragging = false;
		if (dragDeltaY > CLOSE_DRAG_PX) {
			showSearch = false; // close the search modal
		}
		dragDeltaY = 0;
		activePointerId = null;

		// Release pointer capture
		if (dragHandleEl && dragHandleEl.hasPointerCapture(e.pointerId)) {
			dragHandleEl.releasePointerCapture(e.pointerId);
		}
	}

	onMount(async () => {
		try {
			isLoading = true;

			// Load Songs, Prayers, Categories, and Queue in parallel
			const [songsResponse, prayersResponse, categoriesResponse, queueResponse] = await Promise.all(
				[
					supabase
						.from('songs')
						.select(
							`
							id,
							title,
							lyrics,
							category_id
						`
						)
						.order('title', { ascending: true }),

					supabase.from('prayers').select(
						`
						id,
						title,
						content,
						author,
						category_id
					`
					),

					supabase.from('categories').select(`
						id,
						name
					`),

					// Load existing queue for this program
					supabase
						.from('program_queue')
						.select('*')
						.eq('program_code', programCode)
						.eq('item_type', 'song')
						.order('position', { ascending: true })
				]
			);

			// Handle Songs
			if (songsResponse.error) {
				throw songsResponse.error;
			}
			songs = songsResponse.data || [];

			// Handle Prayers
			if (prayersResponse.error) {
				throw prayersResponse.error;
			}
			prayers = prayersResponse.data || [];

			// Handle Categories
			if (categoriesResponse.error) {
				throw categoriesResponse.error;
			}
			categories = categoriesResponse.data || [];

			// Handle Queue
			if (queueResponse.error) {
				throw queueResponse.error;
			}

			// Reconstruct queue items from database
			queue = reconstructQueueItems(queueResponse.data || []);

			// Set up real-time subscription for queue changes
			queueSubscription = supabase
				.channel(`program_queue_${programCode}`)
				.on(
					'postgres_changes',
					{
						event: '*',
						schema: 'public',
						table: 'program_queue'
						// Temporarily removed filter to test
					},
					async (payload) => {
						console.log('🔔 Queue change detected:', payload);
						await loadQueue();
					}
				)
				.subscribe((status) => {
					console.log(`📡 Queue subscription status: ${status}`);
					if (status === 'SUBSCRIBED') {
						console.log('✅ Realtime connection successful!');
					} else if (status === 'CHANNEL_ERROR') {
						console.warn('⚠️ Realtime connection failed. Using fallback polling...');
						// Start aggressive polling if realtime fails
						if (!categoriesRefreshInterval) {
							categoriesRefreshInterval = setInterval(loadQueue, 2000);
						}
					}
				});

			// Set up real-time subscription for category changes
			categoriesSubscription = supabase
				.channel('categories_channel')
				.on(
					'postgres_changes',
					{
						event: '*',
						schema: 'public',
						table: 'categories'
					},
					async () => {
						await loadCategories();
					}
				)
				.subscribe();

			// Poll as a fallback in case realtime is disabled
			categoriesRefreshInterval = setInterval(loadCategories, 5000);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load data';
		} finally {
			isLoading = false;
		}
	});

	// Cleanup subscription when component is destroyed
	onDestroy(() => {
		if (queueSubscription) {
			supabase.removeChannel(queueSubscription);
		}
		if (categoriesSubscription) {
			supabase.removeChannel(categoriesSubscription);
		}
		if (categoriesRefreshInterval) {
			clearInterval(categoriesRefreshInterval);
		}
		if (queuePollingInterval) {
			clearInterval(queuePollingInterval);
		}
		if (syncTimeout) clearTimeout(syncTimeout);
		if (successMessageTimeout) clearTimeout(successMessageTimeout);
		if (errorMessageTimeout) clearTimeout(errorMessageTimeout);
	});

	// Function to reconstruct queue items from database records
	function reconstructQueueItems(
		queueRecords: Array<{
			item_id: number;
			item_type: string;
			position: number;
		}>
	): QueueItem[] {
		const reconstructed: QueueItem[] = [];

		for (const record of queueRecords) {
			if (record.item_type !== 'song') {
				continue;
			}

			const song = songs.find((s) => s.id === record.item_id) || null;

			if (song) {
				reconstructed.push(song);
			}
		}

		return reconstructed;
	}

	// Function to reload queue from database
	async function loadQueue() {
		try {
			setSyncing();
			const { data: queueData, error: queueError } = await supabase
				.from('program_queue')
				.select('*')
				.eq('program_code', programCode)
				.eq('item_type', 'song')
				.order('position', { ascending: true });

			if (queueError) {
				console.error('Error loading queue:', queueError);
				return;
			}

			queue = reconstructQueueItems(queueData || []);
		} catch (e) {
			console.error('Error reloading queue:', e);
		}
	}

	// Function to reload categories from database
	async function loadCategories() {
		try {
			console.log('🔄 Loading categories...');
			const { data: categoriesData, error: categoriesError } = await supabase
				.from('categories')
				.select('id, name')
				.order('id', { ascending: true }); // ID 1 first, then 2, 3, etc.

			if (categoriesError) {
				console.error('❌ Error reloading categories:', categoriesError);
				return;
			}

			const oldCount = categories.length;
			categories = categoriesData || [];
			console.log(
				`✅ Categories updated: ${categories.length} total (was ${oldCount})`,
				categories
			);
		} catch (e) {
			console.error('❌ Error reloading categories:', e);
		}
	}

	// Updated queue operations to use database
	const queueOperations: QueueOperations<QueueItem> = {
		addToQueue: async (item) => {
			if (!('lyrics' in item)) {
				showError('Prayers are not queueable. Use prayer prompts instead.');
				return;
			}
			try {
				// Check if item is already in queue
				const { data: existingItems, error: checkError } = await supabase
					.from('program_queue')
					.select('id')
					.eq('program_code', programCode)
					.eq('item_id', item.id)
					.eq('item_type', 'song');

				if (checkError) {
					console.error('Error checking existing queue items:', checkError);
					showError('Failed to check queue. Please try again.');
					return;
				}

				if (existingItems && existingItems.length > 0) {
					console.log('Item already in queue');
					showError('✓ Already in queue');
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
					showError('Connection error. Please try again.');
					return;
				}

				const nextPosition =
					maxPositionData && maxPositionData.length > 0 ? maxPositionData[0].position + 1 : 0;

				// Optimistic update
				const prevQueue = queue;
				queue = [...queue, item];

				// Add to database
				const { error: insertError } = await supabase.from('program_queue').insert({
					program_code: programCode,
					item_id: item.id,
					item_type: 'song',
					title: item.title,
					position: nextPosition
				});

				if (insertError) {
					console.error('Error adding to queue:', insertError);
					// revert optimistic update
					queue = prevQueue;
					showError('Failed to add to queue. Please try again.');
					return;
				}

				console.log('✅ Item added to queue:', item.title);
				incrementStat(item, 'use');

				// Track analytics
				trackContentInteraction(item.id, 'lyrics' in item ? 'song' : 'prayer', 'added_to_queue');
				// Show success message
				showSuccessMessage = true;
				if (successMessageTimeout) clearTimeout(successMessageTimeout);
				successMessageTimeout = setTimeout(() => {
					showSuccessMessage = false;
				}, 2000);

				// Dismiss mobile keyboard after adding item
				if (searchInputEl && typeof searchInputEl.blur === 'function') {
					searchInputEl.blur();
				}
				// Final sync (in case of other clients)
				await loadQueue();
			} catch (e) {
				console.error('Error in addToQueue:', e);
			}
		},
		removeFromQueue: async (index) => {
			try {
				if (index < 0 || index >= queue.length) return;

				const itemToRemove = queue[index];

				// Optimistic update
				const prevQueue = queue;
				queue = queue.filter((_, i) => i !== index);

				// Start sync indicator
				setSyncing();

				// Remove from database
				const { error: deleteError } = await supabase
					.from('program_queue')
					.delete()
					.eq('program_code', programCode)
					.eq('item_id', itemToRemove.id)
					.eq('item_type', 'lyrics' in itemToRemove ? 'song' : 'prayer');

				if (deleteError) {
					console.error('Error removing from queue:', deleteError);
					// revert optimistic update
					queue = prevQueue;
					showError('Failed to remove item. Please try again.');
					return;
				}

				// Clear lyrics if we removed the currently displayed item
				if (itemToRemove.title === currentSong) {
					lyrics = '';
					currentSong = '';
					currentAuthor = '';
				}

				console.log('✅ Item removed from queue:', itemToRemove.title);

				// Final sync to ensure order matches server
				await loadQueue();
			} catch (e) {
				console.error('Error in removeFromQueue:', e);
			}
		}
	};

	function removeWithConfirmation(index: number) {
		if (index < 0 || index >= queue.length) return;
		const item = queue[index];
		const itemId = item.id; // capture ID, not index — index may shift if queue updates while dialog is open
		showConfirmDialog(`Remove "${item.title}" from queue?`, () => {
			const currentIndex = queue.findIndex((q) => q.id === itemId);
			if (currentIndex !== -1) {
				queueOperations.removeFromQueue(currentIndex);
			}
		});
	}

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
		// Close search sheet so only the content modal is visible
		showSearch = false;
		syncLyricsToQueue = false; // manual view shouldn't be overridden by queue sync
		currentAuthor = ''; // Clear author immediately

		if ('lyrics' in item) {
			currentItemType = 'song';
			if (item.chords == null || item.media == null) {
				await fetchSongComplete(item as Song);
			}
		} else {
			currentItemType = 'prayer';
			currentAuthor = (item as Prayer).author ?? '';
		}
		lyrics = getContent(item);
		currentSong = item.title;
		showLyrics = true;
		incrementStat(item, 'view');
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

	async function openSearch() {
		showSearch = true;
		// For songs tab, show items directly without category selection
		if (contentTab === 'songs') {
			currentView = 'items';
			selectedCategoryId = null;
		} else {
			// For prayers, show categories first
			currentView = 'categories';
			selectedCategoryId = null;
			if (!categories || categories.length === 0) {
				// kick off load without blocking UI to avoid toggle delay
				void loadCategories();
			}
		}
		selectedCategoryName = '';
		searchQuery = '';
		await tick();
		searchInputEl?.focus();
		searchInputEl?.select();
	}

	// Reactive statements
	const filteredCategories = $derived(filterCategories(categories, searchQuery));
	const categorySongs = $derived(
		selectedCategoryId ? songs.filter((item) => item.category_id === selectedCategoryId) : []
	);
	const categoryPrayers = $derived(
		selectedCategoryId ? prayers.filter((item) => item.category_id === selectedCategoryId) : []
	);
	const filteredCategorySongs = $derived(filterItems(categorySongs, searchQuery));
	const filteredCategoryPrayers = $derived(filterItems(categoryPrayers, searchQuery));
	// Show all songs without category filtering
	const filteredAllSongs = $derived(filterItems(songs, searchQuery));

	$effect(() => {
		if (showLyrics && syncLyricsToQueue && queue.length > 0) {
			const firstItem = queue[0];
			if (currentSong !== firstItem.title) {
				currentItemType = 'lyrics' in firstItem ? 'song' : 'prayer';
				lyrics = getContent(firstItem);
				currentSong = firstItem.title;
				currentAuthor = 'lyrics' in firstItem ? '' : ((firstItem as Prayer).author ?? '');
			}
		}
	});

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
	<h1 class="pt-6 pl-6 font-sans text-xl font-semibold tracking-widest text-black dark:text-white">
		KINDLED
	</h1>

	<div class="flex items-center gap-2 pt-6 pr-6">
		<button
			class="material-symbols-outlined share cursor-pointer text-black dark:text-white"
			aria-label="Share"
			onclick={openShare}>
			share
		</button>
	</div>
</div>

<!-- Success Notification -->
{#if showSuccessMessage}
	<div
		class="fixed top-20 left-1/2 z-50 -translate-x-1/2 transform rounded-lg bg-[#ffa843] px-6 py-3 font-sans text-white shadow-lg"
		in:slide={{ duration: 200 }}
		out:slide={{ duration: 200 }}>
		✓ Added successfully
	</div>
{/if}

<!-- Error Notification -->
{#if showErrorMessage}
	<div
		class="fixed top-20 left-1/2 z-50 -translate-x-1/2 transform rounded-lg bg-red-500 px-6 py-3 font-sans text-white shadow-lg"
		in:slide={{ duration: 200 }}
		out:slide={{ duration: 200 }}>
		{errorMessage}
	</div>
{/if}

<!-- Confirmation Dialog -->
{#if showConfirmation}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
		<div
			class="w-full max-w-sm rounded-[20px] bg-white p-6 shadow-[0_4px_20px_rgba(0,0,0,0.3)] dark:bg-[#2a2a2a]">
			<h3 class="mb-4 text-center font-sans text-lg font-semibold text-black dark:text-white">
				Confirm Action
			</h3>
			<p class="mb-6 text-center font-sans text-sm text-gray-700 dark:text-gray-300">
				{confirmationMessage}
			</p>
			<div class="flex gap-3">
				<button
					onclick={cancelConfirmation}
					class="flex-1 rounded-lg border border-gray-300 bg-gray-100 px-4 py-2 font-sans font-semibold text-gray-900 hover:bg-gray-200 dark:border-[#4a4a4a] dark:bg-[#3a3a3a] dark:text-white dark:hover:bg-[#4a4a4a]">
					Cancel
				</button>
				<button
					onclick={executeConfirmation}
					class="flex-1 rounded-lg bg-[#ffa843] px-4 py-2 font-sans font-semibold text-white shadow-[0_4px_4px_0_rgba(0,0,0,0.25)] transition-all hover:bg-[#e38b2d]">
					Remove
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Loading State -->
{#if isLoading}
	<div class="mt-10 flex items-center justify-center">
		<p class="font-sans text-lg text-gray-600 dark:text-gray-400">Loading content...</p>
	</div>
{/if}

<!-- Error State -->
{#if error}
	<div class="mt-10 flex items-center justify-center">
		<p class="font-sans text-lg text-red-600 dark:text-red-400">Error: {error}</p>
	</div>
{/if}

<!-- Search Input -->
<div class="mt-2 flex flex-col items-center justify-center">
	<div class="relative w-80">
		<input
			onclick={openSearch}
			type="text"
			maxlength="20"
			placeholder="Search for Prayer or Song..."
			readonly
			class="h-15 w-full rounded-[20px] border border-gray-300 bg-white pl-10 font-sans text-gray-900 shadow-[0_4px_4px_0_rgba(0,0,0,0.25)] placeholder:text-gray-400 hover:bg-gray-50 dark:border-[#3a3a3a] dark:bg-[#2a2a2a] dark:text-gray-400 dark:shadow-[0_4px_4px_0_rgba(0,0,0,0.25)] dark:hover:bg-[#1a1a1a]" />
		<span
			class="material-symbols-outlined flame absolute top-1/2 left-1 -translate-y-1/2 transform text-[#ffa843]">
			local_fire_department
		</span>
	</div>
	<h2
		class="mt-20 text-center font-sans text-[30px] leading-tight font-bold tracking-wide text-black dark:text-white">
		{data.room.title}<br />
	</h2>
	<p class="mt-30 font-sans font-semibold text-black dark:text-[#ffa843]">LYRICS</p>
	<div class="mt-4 flex items-center justify-center">
		<button
			class="material-symbols-outlined arrow flex h-7 w-12 cursor-pointer items-center justify-center rounded-[10px] bg-white pb-8 text-center text-[#ffa843] shadow-[0_4px_4px_0_rgba(0,0,0,0.25)] hover:bg-gray-50 dark:bg-[#2a2a2a] dark:hover:bg-[#3a3a3a]"
			disabled={queue.length === 0}
			onclick={() => {
				if (queue.length > 0) {
					const firstItem = queue[0];
					syncLyricsToQueue = true; // enable auto-sync when viewing from queue
					currentItemType = 'song';
					currentAuthor = '';
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
<section class="mt-10 px-4 py-4 md:px-20">
	<div class="flex items-center justify-between">
		<h2 class="font-sans text-[10px] font-bold tracking-wide text-black dark:text-[#ffa843]">
			QUEUED
		</h2>
		<span
			class="mr-39 inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-gray-200 dark:bg-[#2a2a2a] px-1.5 text-center font-semibold text-black dark:text-[#ffa843]">
			{queue.length}
		</span>
		<button
			onclick={openSearch}
			class="material-symbols-outlined add mb-1 h-7 w-10 cursor-pointer rounded-[20px] border border-gray-300 bg-gray-100 shadow-[0_4px_4px_0_rgba(0,0,0,0.25)] hover:bg-white dark:border-[#3a3a3a] dark:bg-[#2a2a2a] dark:hover:bg-[#3a3a3a]"
			aria-label="Add song">
			add
		</button>
	</div>

	<!-- Queue List with Scrolling -->
	<div class="queue-container mt-4">
		<ul class="queue-list">
			{#each queue as item, i (item.id)}
				<li
					class="queue-item"
					style="opacity: {Math.max(0.2, 1 - i * 0.08)};"
					in:fade={{ duration: 150 }}
					out:slide={{ duration: 150 }}>
					<div class="flex min-w-0 flex-col">
						<span class="truncate">{item.title}</span>
						{#if !('lyrics' in item) && (item as Prayer).author}
							<span class="queue-author">{(item as Prayer).author}</span>
						{/if}
					</div>
					<div class="ml-2 flex flex-shrink-0 items-center gap-2">
						{#if isSyncingQueue}
							<span class="animate-pulse text-xs text-gray-400">syncing...</span>
						{/if}
						<button
							onclick={() => removeWithConfirmation(i)}
							class="close material-symbols-outlined text-[#ffa843] hover:text-[#e38b2d]"
							aria-label="Remove from queue">
							close
						</button>
					</div>
				</li>
			{/each}
		</ul>
		{#if queue.length === 0}
			<p class="py-8 text-center text-sm text-gray-500 dark:text-gray-400">No songs in queue</p>
		{/if}
	</div>
</section>

<!-- Share Modal (small box) -->
{#if showShare}
	<div class="fixed inset-0 z-20 flex items-center justify-center bg-black/20 px-4">
		<div
			class="relative w-full max-w-sm rounded-[20px] bg-white p-4 shadow-[0_4px_12px_rgba(0,0,0,0.25)] dark:bg-[#2a2a2a]">
			<button
				onclick={() => (showShare = false)}
				class="material-symbols-outlined absolute top-2 right-2 cursor-pointer text-[#ffa843] hover:text-[#e38b2d]">
				close
			</button>
			<h3 class="mb-3 text-center font-sans text-sm font-bold tracking-wide text-[#ffa843]">
				SHARE ROOM
			</h3>
			<div class="grid grid-cols-[auto_1fr] items-center gap-3">
				<!-- QR -->
				<div
					class="flex h-[160px] w-[160px] items-center justify-center rounded-[12px] bg-white shadow-[0_2px_6px_rgba(0,0,0,0.15)]">
					{#if qrSrc}
						<img src={qrSrc} alt="QR Code for room" class="h-[150px] w-[150px]" />
					{:else}
						<div class="flex h-[150px] w-[150px] items-center justify-center text-xs text-gray-500">
							QR unavailable
						</div>
					{/if}
				</div>
				<!-- Code + actions -->
				<div class="flex min-w-0 flex-col justify-center">
					<p class="font-sans text-[10px] font-bold tracking-wide text-gray-500 dark:text-gray-400">
						ROOM CODE
					</p>
					<div class="mt-1 flex items-center gap-2">
						<span class="truncate font-sans text-2xl font-extrabold tracking-widest text-[#ffa843]">
							{programCode}
						</span>
						<button
							onclick={copyCode}
							class="material-symbols-outlined flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-black hover:bg-gray-200 dark:bg-[#3a3a3a] dark:text-white dark:hover:bg-[#4a4a4a]"
							title="Copy code">
							content_copy
						</button>
					</div>
					<p class="mt-4 line-clamp-2 text-xs break-all text-gray-500 dark:text-gray-400">
						{shareUrl}
					</p>
					<div class="mt-3 flex gap-2">
						<button
							class="rounded-[12px] border border-gray-300 bg-gray-100 px-3 py-2 font-sans text-xs font-bold tracking-widest text-gray-900 hover:bg-gray-200 dark:border-[#4a4a4a] dark:bg-[#3a3a3a] dark:text-white dark:hover:bg-[#4a4a4a]"
							onclick={() => {
								if (navigator.share) {
									navigator.share({ title: 'Join my room', url: shareUrl }).catch(() => {});
								}
							}}>
							NATIVE SHARE
						</button>
						<a
							class="rounded-[12px] bg-gray-100 px-3 py-2 font-sans text-xs font-semibold text-black hover:bg-gray-200 dark:bg-[#3a3a3a] dark:text-white dark:hover:bg-[#4a4a4a]"
							href={shareUrl}
							target="_blank"
							rel="noreferrer">
							OPEN LINK
						</a>
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}

<!-- Search Modal -->
{#if showSearch}
	<div
		class="fixed inset-0 z-10 flex items-end justify-center px-4"
		in:slide|local={{ duration: 300 }}
		out:slide|local={{ duration: 200 }}>
		<div
			bind:this={searchSheetEl}
			class="h-[90%] w-full max-w-md overflow-y-auto rounded-t-[30px] bg-white dark:bg-[#2a2a2a]"
			style="transform: translateY({dragDeltaY}px); transition: {dragging
				? 'none'
				: 'transform 200ms ease'};">
			<!-- Drag handle -->
			<div
				bind:this={dragHandleEl}
				class="drag-handle-area"
				onpointerdown={handleDragStart}
				onpointermove={handleDragMove}
				onpointerup={handleDragEnd}
				onpointercancel={handleDragEnd}
				title="Drag down to close">
				<div class="drag-handle-bar"></div>
			</div>

			<!-- Header with close button -->
			<div class="mt-6 flex flex-col items-center justify-center px-4">
				<button
					class="material-symbols-outlined slide cursor-pointer text-[#ffa843]"
					onclick={() => (showSearch = false)}>remove</button>

				<!-- Search Input -->
				<div class="relative mt-4 w-full max-w-80">
					<input
						bind:this={searchInputEl}
						bind:value={searchQuery}
						type="text"
						maxlength="20"
						placeholder={currentView === 'categories'
							? 'Search categories...'
							: contentTab === 'songs'
								? 'Search songs...'
								: 'Search prayers...'}
						class="h-[60px] w-full rounded-[20px] border border-gray-300 bg-gray-50 pl-10 font-sans text-gray-900 shadow-sm placeholder:text-gray-400 hover:bg-white dark:border-[#3a3a3a] dark:bg-[#1a1a1a] dark:text-white dark:shadow-[0_4px_4px_0_rgba(0,0,0,0.25)] dark:hover:bg-black" />
					<span
						class="material-symbols-outlined flame absolute top-1/2 left-1 -translate-y-1/2 transform text-[#ffa843]">
						local_fire_department
					</span>
				</div>
			</div>

			<!-- Navigation Header -->
			<div class="mt-6 mb-5 flex items-center justify-center px-4">
				{#if currentView === 'items' && selectedCategoryId !== null}
					<button
						onclick={goBackToCategories}
						class="material-symbols-outlined mr-2 cursor-pointer text-gray-900 hover:text-gray-700 dark:text-[#ffa843] dark:hover:text-[#e38b2d]">
						arrow_back
					</button>
				{/if}
				<h2
					class="text-center font-sans text-[18px] font-medium tracking-wide text-gray-900 underline dark:text-[#ffa843]">
					{currentView === 'categories'
						? 'CATEGORIES'
						: selectedCategoryId !== null
							? selectedCategoryName.toUpperCase()
							: contentTab === 'songs'
								? 'SONGS'
								: 'PRAYERS'}
				</h2>
			</div>

			<!-- Mode toggle: Songs vs Prayers (hide when drilled into a category's items) -->
			{#if currentView !== 'items' || selectedCategoryId === null}
				<div class="mb-2 flex items-center justify-center gap-2">
					<button
						class="rounded-full px-3 py-1 font-sans text-sm {contentTab === 'songs'
							? 'bg-[#ffa843] text-white'
							: 'bg-gray-200 text-gray-700 dark:bg-[#2a2a2a] dark:text-gray-400'}"
						onclick={() => {
							contentTab = 'songs';
							// For songs, show items directly without category selection
							if (currentView === 'categories') {
								currentView = 'items';
								selectedCategoryId = null;
								searchQuery = '';
							}
						}}>
						Songs
					</button>
					<button
						class="rounded-full px-3 py-1 font-sans text-sm {contentTab === 'prayers'
							? 'bg-[#ffa843] text-white'
							: 'bg-gray-200 text-gray-700 dark:bg-[#2a2a2a] dark:text-gray-400'}"
						onclick={() => {
							contentTab = 'prayers';
							// For prayers, show categories first
							if (currentView === 'items' && selectedCategoryId === null) {
								currentView = 'categories';
								searchQuery = '';
							}
						}}>
						Prayers
					</button>
				</div>
			{/if}

			<!-- Browse categories/items -->
			{#if currentView === 'categories'}
				<!-- Categories List -->
				{#if categories.length === 0}
					<div class="mt-20 flex flex-col items-center justify-center px-4">
						<p class="text-center font-sans text-gray-400">No categories available yet.</p>
						<p class="mt-2 text-center font-sans text-sm text-gray-500">
							Check back soon for content!
						</p>
					</div>
				{:else if filteredCategories.length > 0}
					<ul
						class="flex w-full flex-col items-center justify-start space-y-3 overflow-y-auto px-4"
						style="max-height: calc(100vh - 280px); scroll-behavior: smooth; touch-action: pan-y; padding-bottom: 24px;">
						{#each filteredCategories as category (category.id)}
							<li class="flex w-full items-center justify-center">
								<button
									type="button"
									class="flex h-[60px] w-full max-w-[360px] items-center justify-between rounded-[20px] bg-white border border-gray-200 dark:bg-[#2a2a2a] dark:border-[#3a3a3a] px-6 font-sans font-medium shadow-[0_2px_4px_0_rgba(0,0,0,0.06)] dark:shadow-[0_4px_4px_0_rgba(0,0,0,0.25)] hover:bg-gray-50 dark:hover:bg-[#333333]"
									onclick={() => selectCategory(category)}>
									<span class="font-semibold text-gray-900 dark:text-white">{category.name}</span>
									<span class="material-symbols-outlined text-gray-400"> chevron_right </span>
								</button>
							</li>
						{/each}
					</ul>
				{:else}
					<p class="mt-4 text-center text-sm text-gray-400">No matching categories found.</p>
				{/if}
			{:else if currentView === 'items'}
				<!-- Items for Selected Category or All Items -->
				{#if contentTab === 'songs'}
					{#if selectedCategoryId === null ? filteredAllSongs.length > 0 : filteredCategorySongs.length > 0}
						<ul
							class="flex w-full flex-col items-center justify-start space-y-3 overflow-y-auto px-4"
							style="max-height: calc(100vh - 280px); scroll-behavior: smooth; touch-action: pan-y; padding-bottom: 24px;">
							{#each selectedCategoryId === null ? filteredAllSongs : filteredCategorySongs as item (item.id)}
								<li
									class="flex h-16 w-full max-w-sm items-center justify-between gap-3 rounded-[20px] bg-white border border-gray-200 dark:bg-[#2a2a2a] dark:border-[#3a3a3a] px-4 font-sans shadow-[0_2px_4px_0_rgba(0,0,0,0.06)] dark:shadow-[0_4px_4px_0_rgba(0,0,0,0.25)] hover:bg-gray-50 dark:hover:bg-[#333333] sm:px-6">
									<!-- Centered title -->
									<div class="flex min-w-0 flex-1 justify-center">
										<span class="block max-w-xs truncate text-center font-semibold text-gray-900 dark:text-white"
											>{item.title}</span>
									</div>
									<!-- Action buttons (right) -->
									<div class="flex flex-shrink-0 items-center gap-2">
										<button
											onclick={() => fetchContent(item)}
											class="action-btn eye material-symbols-outlined cursor-pointer text-black"
											title="View content">
											visibility
										</button>
										<button
											onclick={() => queueOperations.addToQueue(item)}
											class="action-btn plus material-symbols-outlined cursor-pointer text-white"
											title="Add to queue">
											add
										</button>
									</div>
								</li>
							{/each}
						</ul>
					{:else}
						<div class="mt-8 text-center">
							<p class="text-sm text-gray-400">
								{selectedCategoryId === null
									? 'No songs available.'
									: 'No songs found in this category.'}
							</p>
							{#if selectedCategoryId !== null}
								<button
									onclick={goBackToCategories}
									class="mt-4 rounded-lg bg-[#ffa843] px-4 py-2 font-sans text-white hover:bg-[#e38b2d]">
									Back to Categories
								</button>
							{/if}
						</div>
					{/if}
				{:else if filteredCategoryPrayers.length > 0}
					<ul
						class="flex w-full flex-col items-center justify-start space-y-3 overflow-y-auto px-4"
						style="max-height: calc(100vh - 280px); scroll-behavior: smooth; touch-action: pan-y; padding-bottom: 24px;">
						{#each filteredCategoryPrayers as item (item.id)}
							<li
								class="flex h-16 w-full max-w-sm items-center justify-between gap-3 rounded-[20px] bg-white border border-gray-200 dark:bg-[#2a2a2a] dark:border-[#3a3a3a] px-4 font-sans shadow-[0_2px_4px_0_rgba(0,0,0,0.06)] dark:shadow-[0_4px_4px_0_rgba(0,0,0,0.25)] hover:bg-gray-50 dark:hover:bg-[#333333] sm:px-6">
								<!-- Centered title -->
								<div class="flex min-w-0 flex-1 justify-center">
									<span class="block max-w-xs truncate text-center font-semibold text-gray-900 dark:text-white"
										>{item.title}</span>
								</div>
								<!-- Action buttons (right) -->
								<div class="flex flex-shrink-0 items-center gap-2">
									<button
										onclick={() => fetchContent(item)}
										class="action-btn eye material-symbols-outlined cursor-pointer text-black"
										title="View content">
										visibility
									</button>
								</div>
							</li>
						{/each}
					</ul>
				{:else}
					<div class="mt-8 text-center">
						<p class="text-sm text-gray-400">No prayers found in this category.</p>
						<button
							onclick={goBackToCategories}
							class="mt-4 rounded-lg bg-[#ffa843] px-4 py-2 font-sans text-white hover:bg-[#e38b2d]">
							Back to Categories
						</button>
					</div>
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
		<div class="h-[90%] w-full max-w-md rounded-t-[30px] bg-white dark:bg-[#2a2a2a]">
			<div class="flex flex-col items-center justify-center">
				<button
					onclick={() => (showLyrics = false)}
					class="material-symbols-outlined slide cursor-pointer text-[#ffa843]">remove</button>
			</div>
			<h1 class="flex justify-center text-center font-sans font-bold text-[#ffa843]">
				{currentItemType === 'song' ? 'Lyrics' : 'Prayer'}
			</h1>
			<div
				class="overflow-y-auto p-4 font-sans text-lg font-medium whitespace-pre-line text-gray-900 dark:text-white {currentItemType ===
				'prayer'
					? 'prayer-content text-center'
					: 'song-content text-left'}"
				style="max-height: 70%; width: 90%; margin: auto;">
				{lyrics}
				{#if currentAuthor}
					<p class="author-line-modal after-content font-bold">{currentAuthor}</p>
				{/if}
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
		filter: drop-shadow(0 0 8px rgba(255, 168, 67, 0.6))
			drop-shadow(0 0 16px rgba(255, 168, 67, 0.4)) drop-shadow(0 0 24px rgba(255, 168, 67, 0.2));
		transition: all 0.3s ease;
		animation: flameGlow 2s ease-in-out infinite alternate;
	}

	.flame:hover {
		transform: scale(1.15);
		filter: drop-shadow(0 0 12px rgba(255, 168, 67, 0.8))
			drop-shadow(0 0 24px rgba(255, 168, 67, 0.6)) drop-shadow(0 0 36px rgba(255, 168, 67, 0.4));
	}

	@keyframes flameGlow {
		0% {
			filter: drop-shadow(0 0 8px rgba(255, 168, 67, 0.6))
				drop-shadow(0 0 16px rgba(255, 168, 67, 0.4)) drop-shadow(0 0 24px rgba(255, 168, 67, 0.2));
		}
		100% {
			filter: drop-shadow(0 0 12px rgba(255, 168, 67, 0.8))
				drop-shadow(0 0 20px rgba(255, 168, 67, 0.5)) drop-shadow(0 0 28px rgba(255, 168, 67, 0.3));
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

	/* Uniform action buttons for list items */
	.action-btn {
		width: 36px;
		height: 36px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 9999px;
		padding: 0;
		border: 1px solid transparent;
		box-shadow: 0 3px 8px rgba(0, 0, 0, 0.08);
		transition:
			transform 160ms ease,
			box-shadow 160ms ease,
			background-color 160ms ease,
			border-color 160ms ease;
	}
	.action-btn.eye {
		background: #ffffff;
		border-color: #e5e7eb;
		color: #ffa843;
	}
	.action-btn.eye:hover {
		background: #f8fafc;
		box-shadow: 0 4px 10px rgba(0, 0, 0, 0.12);
		transform: translateY(-1px);
	}
	.action-btn.plus {
		background: linear-gradient(135deg, #ffb870, #ffa843);
		color: white;
	}
	.action-btn.plus:hover {
		background: linear-gradient(135deg, #ffa843, #e38b2d);
		box-shadow: 0 4px 12px rgba(255, 168, 67, 0.28);
		transform: translateY(-1px);
	}

	/* Fix scrollbar styling */
	.queue-container {
		max-height: 300px; /* Adjust this value based on your needs */
		overflow-y: auto;
		padding-right: 4px; /* Space for scrollbar */
		scrollbar-width: thin;
		scrollbar-color: #ffa843 transparent;
	}

	.queue-container::-webkit-scrollbar {
		width: 8px;
	}

	.queue-container::-webkit-scrollbar-track {
		background: transparent;
		border-radius: 4px;
	}

	.queue-container::-webkit-scrollbar-thumb {
		background-color: #ffa843;
		border-radius: 4px;
		border: 1px solid transparent;
		background-clip: content-box;
	}

	.queue-container::-webkit-scrollbar-thumb:hover {
		background-color: #e38b2d;
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

	@media (prefers-color-scheme: dark) {
		.queue-item {
			background: #2a2a2a;
			box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
		}
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

	@media (prefers-color-scheme: dark) {
		.queue-item span {
			color: #e5e7eb;
		}
	}

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
		color: #ffa843;
	}

	.author-line-modal {
		text-align: right; /* right aligned "off centered" attribution */
		margin-top: 12px;
		font-size: 0.75rem;
		line-height: 1.1;
		color: #ffa843; /* same color as content text */
		font-style: italic;
		opacity: 0.9;
		padding-right: 4px;
	}

	.author-line-modal.after-content {
		display: block;
	}

	/* Song content styling */
	.song-content {
		line-height: 1.8;
		letter-spacing: 0.5px;
		word-spacing: 0.1em;
		max-width: 65ch;
		margin-left: auto;
		margin-right: auto;
		padding-bottom: 1.5rem;
	}

	/* Prayer content styling */
	.prayer-content {
		line-height: 1.9;
		letter-spacing: 0.5px;
		word-spacing: 0.1em;
		max-width: 65ch;
		margin-left: auto;
		margin-right: auto;
		padding-bottom: 1.5rem;
	}

	.prayer-content::first-letter {
		font-size: 3.5em;
		font-weight: bold;
		line-height: 1;
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

	/* Sync pulse animation */
	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
	}

	.animate-pulse {
		animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
	}

	/* Drag-to-close handle */
	.drag-handle-area {
		display: flex;
		justify-content: center;
		align-items: center;
		padding-top: 8px;
		padding-bottom: 4px;
		cursor: grab;
		touch-action: none; /* prevent scroll while dragging the handle */
	}
	.drag-handle-area:active {
		cursor: grabbing;
	}
	.drag-handle-bar {
		width: 48px;
		height: 5px;
		background: #ffa843; /* flame color */
		border-radius: 9999px;
	}
</style>
