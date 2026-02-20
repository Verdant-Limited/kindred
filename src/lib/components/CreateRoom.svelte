<script lang="ts">
	import { fade } from 'svelte/transition';
	import { tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { supabase } from '$lib/config/supabaseClient';
	import QRCode from 'qrcode';
	import Toast from './Toast.svelte';

	type Program = {
		id: string;
		title: string;
		description?: string;
		created_by: string;
		created_at: string;
		status: 'active' | 'inactive' | 'ended';
	};

	let showCreate = false;
	let title = '';
	let description = '';
	let username = '';
	let isLoading = false;
	let errorMessage = '';
	let titleError = '';
	let usernameError = '';
	let successMessage = '';
	let createdRoomCode = '';
	let qrCodeUrl = '';
	let toastComponent: Toast;
	let showQrModal = false;
	let titleInputRef: HTMLInputElement;
	let redirectTimer: ReturnType<typeof setTimeout> | undefined;

	// Load saved username from localStorage
	if (typeof window !== 'undefined') {
		username = localStorage.getItem('kindredUsername') || '';
	}

	function handleStart() {
		showCreate = true;
	}

	function handleClose() {
		clearTimeout(redirectTimer);
		showCreate = false;
		resetForm();
	}

	function resetForm() {
		title = '';
		description = '';
		errorMessage = '';
		titleError = '';
		usernameError = '';
	}

	function validateTitle() {
		titleError = !title.trim() ? 'Please add a title' : '';
	}

	function validateUsername() {
		usernameError = !username.trim() ? 'Please enter a username' : '';
	}

	async function focusTitle() {
		if (!showCreate) {
			handleStart();
			await tick();
		}
		titleInputRef?.focus();
	}

	async function generateRoomCode(): Promise<string> {
		for (let attempt = 0; attempt < 5; attempt++) {
			const code = Math.floor(1000 + Math.random() * 9000).toString();
			const { data } = await supabase.from('programs').select('id').eq('id', code).maybeSingle();
			if (!data) return code;
		}
		throw new Error('Could not generate a unique room code. Please try again.');
	}

	async function handleCreate() {
		try {
			errorMessage = '';
			validateTitle();
			validateUsername();
			if (!title.trim() || !username.trim()) {
				return;
			}

			// Save username to localStorage
			localStorage.setItem('kindredUsername', username.trim());

			isLoading = true;
			const roomCode = await generateRoomCode();

			const newProgram: Omit<Program, 'id' | 'created_at'> = {
				title: title.trim(),
				description: description.trim(),
				created_by: username.trim(),
				status: 'active'
			};

			const { data, error } = await supabase
				.from('programs')
				.insert({
					id: roomCode,
					...newProgram,
					created_at: new Date().toISOString(),
					last_activity: new Date().toISOString()
				})
				.select('id')
				.single();

			if (error) {
				throw new Error(error.message);
			}

			if (!data?.id) {
				throw new Error('No room ID returned from database');
			}

			// Show success message and QR code
			createdRoomCode = data.id;
			successMessage = `Room created! Code: ${data.id}`;
			showQrModal = true;
			toastComponent?.show(`✓ Room created! Code: ${data.id}`, 'success');

			// Generate QR code
			try {
				qrCodeUrl = await QRCode.toDataURL(`${window.location.origin}/lobby/${data.id}`, {
					width: 300
				});
			} catch {
				// QR code generation failed, but continue anyway
			}

			// Auto-navigate after 5 seconds
			redirectTimer = setTimeout(() => {
				handleClose();
				goto(`/lobby/${data.id}`);
			}, 5000);
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : "Wasn't able to create the program.";
			toastComponent?.show(errorMessage, 'error');
		} finally {
			isLoading = false;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !isLoading) {
			handleCreate();
		}
	}

	function closeQrModal() {
		clearTimeout(redirectTimer);
		showQrModal = false;
	}

	function goToRoom() {
		clearTimeout(redirectTimer);
		handleClose();
		goto(`/lobby/${createdRoomCode}`);
	}
</script>

<div class="mt-20 flex flex-col items-center justify-center md:mt-36">
	<span class="fire material-symbols-outlined mt-26 text-black dark:text-[#ffa843]"
		>local_fire_department</span>

	<div class="mt-2 flex flex-col items-center justify-center">
		<h2 class="mt-9 font-sans text-[29px] font-bold tracking-wider text-black dark:text-white">
			OPEN PROGRAM
		</h2>
		<p
			class="mt-2 max-w-md text-center font-sans text-[14px] tracking-wider text-gray-500 dark:text-[#a0a0a0]">
			Start an open program where <br />
			anyone can add songs & prayers
		</p>
		<button
			type="button"
			class="mt-11 cursor-pointer rounded-xl bg-[#ffa843] px-16 py-3 font-sans text-[14px] font-bold tracking-widest text-white shadow-[0_4px_4px_0_rgba(0,0,0,0.25)] transition-all hover:bg-[#e38b2d] focus:ring-2 focus:ring-orange-400 focus:ring-offset-2 focus:outline-none dark:shadow-[0_4px_4px_0_rgba(0,0,0,0.5)]"
			on:click={handleStart}>
			START
		</button>
	</div>
</div>

{#if showCreate}
	<div class="fixed inset-0 z-50 flex items-center justify-center">
		<button
			type="button"
			class="bg-blur-sm bg-opacity-25 absolute inset-0 backdrop-blur-sm"
			aria-label="Close modal"
			on:click={handleClose}></button>

		<div
			class="relative w-full max-w-[390px] rounded-2xl bg-white p-6 shadow-lg dark:bg-[#2a2a2a]"
			in:fade={{ duration: 200 }}
			out:fade={{ duration: 150 }}>
			<header class="flex justify-end">
				<button
					type="button"
					class="rounded text-2xl text-gray-500 transition-all hover:text-gray-700 focus:ring-2 focus:ring-orange-400 focus:outline-none dark:text-gray-400 dark:hover:text-gray-300"
					on:click={handleClose}>
					×
				</button>
			</header>

			{#if errorMessage}
				<div
					class="mb-4 rounded-md bg-red-50 p-3 text-red-600 dark:bg-red-900/30 dark:text-red-400">
					{errorMessage}
				</div>
			{/if}

			<div class="mt-2 flex flex-col space-y-4">
				<label class="flex flex-col">
					<span class="text-sm font-medium text-orange-600 dark:text-orange-300"
						>Program Title</span>
					<input
						type="text"
						placeholder="Enter a title…"
						bind:value={title}
						bind:this={titleInputRef}
						on:keydown={handleKeydown}
						on:blur={validateTitle}
						class="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-400 shadow-sm transition-all focus:border-orange-400 focus:ring-2 focus:ring-orange-400 focus:outline-none dark:border-[#3a3a3a] dark:bg-[#1a1a1a] dark:text-white dark:placeholder-[#606060]" />
					{#if titleError}
						<span class="mt-1 text-xs text-red-600 dark:text-red-400">{titleError}</span>
					{/if}
				</label>

				<label class="flex flex-col">
					<span class="text-sm font-medium text-orange-600 dark:text-orange-300"
						>Description (optional)</span>
					<textarea
						rows="4"
						placeholder="Describe the program…"
						bind:value={description}
						on:keydown={handleKeydown}
						class="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-400 shadow-sm transition-all focus:border-orange-400 focus:ring-2 focus:ring-orange-400 focus:outline-none dark:border-[#3a3a3a] dark:bg-[#1a1a1a] dark:text-white dark:placeholder-[#606060]"
					></textarea>
				</label>

				<label class="flex flex-col">
					<span class="text-sm font-medium text-orange-600 dark:text-orange-300">Username</span>
					<input
						type="text"
						placeholder="Enter your username…"
						bind:value={username}
						on:keydown={handleKeydown}
						on:blur={validateUsername}
						class="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-400 shadow-sm transition-all focus:border-orange-400 focus:ring-2 focus:ring-orange-400 focus:outline-none dark:border-[#3a3a3a] dark:bg-[#1a1a1a] dark:text-white dark:placeholder-[#606060]" />
					{#if usernameError}
						<span class="mt-1 text-xs text-red-600 dark:text-red-400">{usernameError}</span>
					{/if}
				</label>
			</div>

			<div class="mt-6 flex justify-center">
				<button
					type="button"
					on:click={handleCreate}
					disabled={isLoading}
					class="cursor-pointer rounded-full bg-[#ffa843] px-12 py-3 font-semibold text-white shadow-[0_4px_4px_0_rgba(0,0,0,0.25)] transition-all hover:bg-[#e38b2d] focus:ring-2 focus:ring-orange-600 focus:ring-offset-2 focus:outline-none disabled:opacity-50">
					{#if isLoading}
						Creating...
					{:else}
						Create
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}

{#if showQrModal && qrCodeUrl}
	<div class="fixed inset-0 z-50 flex items-center justify-center">
		<button
			type="button"
			class="bg-blur-sm bg-opacity-25 absolute inset-0 backdrop-blur-sm"
			aria-label="Close QR modal"
			on:click={closeQrModal}></button>

		<div
			class="relative w-full max-w-[390px] rounded-2xl bg-white p-6 shadow-lg dark:bg-[#2a2a2a]"
			in:fade={{ duration: 200 }}
			out:fade={{ duration: 150 }}>
			<header class="flex justify-end">
				<button
					type="button"
					class="rounded text-2xl text-gray-500 transition-all hover:text-gray-700 focus:ring-2 focus:ring-orange-400 focus:outline-none dark:text-gray-400 dark:hover:text-gray-300"
					on:click={closeQrModal}>
					×
				</button>
			</header>

			<div class="flex flex-col items-center space-y-4">
				<p class="text-center text-sm font-medium text-gray-700 dark:text-gray-300">
					Share this QR code or code with others:
				</p>
				<img src={qrCodeUrl} alt="Room QR Code" class="rounded-lg shadow-md" />
				<div class="flex items-center space-x-2 rounded-lg bg-gray-50 px-4 py-3 dark:bg-[#1a1a1a]">
					<span class="font-mono text-lg font-bold text-gray-900 dark:text-white"
						>{createdRoomCode}</span>
					<button
						type="button"
						on:click={() => {
							navigator.clipboard.writeText(createdRoomCode);
							toastComponent?.show('Code copied to clipboard!', 'success');
						}}
						class="ml-2 rounded-md bg-orange-400 px-3 py-1 text-xs font-semibold text-white transition-all hover:bg-orange-500 focus:ring-2 focus:ring-orange-600 focus:outline-none">
						Copy
					</button>
				</div>
				<button
					type="button"
					on:click={goToRoom}
					class="w-full cursor-pointer rounded-full bg-[#ffa843] px-12 py-3 font-semibold text-white shadow-[0_4px_4px_0_rgba(0,0,0,0.25)] transition-all hover:bg-[#e38b2d] focus:ring-2 focus:ring-orange-400 focus:ring-offset-2 focus:outline-none">
					Go to Room
				</button>
				<p class="text-xs text-gray-500">Auto-redirecting in 5 seconds...</p>
			</div>
		</div>
	</div>
{/if}

<Toast bind:this={toastComponent} />

<style>
	.fire {
		/* Scale icon sensibly on small phones */
		font-size: clamp(120px, 30vw, 200px);
		z-index: 2;
	}
</style>
