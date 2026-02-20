<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { fade } from 'svelte/transition';
	import { supabase } from '$lib/config/supabaseClient';
	import Toast from './Toast.svelte';

	let code = '';
	let isLoading = false;
	let errorMessage = '';
	let codeError = '';
	let toastComponent: Toast | undefined;
	let codeInputRef: HTMLInputElement;

	// Check for active session on mount
	onMount(() => {
		const savedRoomCode = localStorage.getItem('currentRoomCode');
		const roomCodeTimestamp = localStorage.getItem('roomCodeTimestamp');
		const isWithinSession = roomCodeTimestamp && Date.now() - parseInt(roomCodeTimestamp) < 3600000; // 1 hour

		if (savedRoomCode && isWithinSession) {
			// Auto-rejoin the room
			goto(`/lobby/${savedRoomCode}`);
		}
	});

	function focusCodeInput() {
		if (codeInputRef) {
			codeInputRef.focus();
		}
	}

	function validateCode() {
		const trimmed = code.trim();
		if (!trimmed) {
			codeError = 'Please enter a room code';
		} else if (trimmed.length !== 4) {
			codeError = 'Room code must be 4 digits';
		} else if (!/^\d+$/.test(trimmed)) {
			codeError = 'Room code must contain only numbers';
		} else {
			codeError = '';
		}
	}

	async function handleJoin() {
		try {
			errorMessage = '';
			codeError = '';
			validateCode();

			if (codeError) {
				return;
			}

			isLoading = true;
			code = code.trim();

			// Query the program using the 'id' column (text type)
			const { data: programs, error } = await supabase.from('programs').select('*').eq('id', code);

			if (error) {
				throw new Error('Failed to check program: ' + error.message);
			}

			if (!programs || programs.length === 0) {
				throw new Error('Room not found. Please check the code and try again.');
			}

			const room = programs[0];

			// Check room status and provide helpful messages
			if (room.status === 'ended') {
				throw new Error(
					'This room has been ended by the creator. Please create a new room or join a different one.'
				);
			}

			if (room.status === 'inactive') {
				throw new Error('This room has been inactive for over 24 hours. Please create a new room.');
			}

			if (room.status !== 'active') {
				throw new Error('This room is not available. Please try a different code.');
			}

			// Update last_activity when joining
			await supabase
				.from('programs')
				.update({ last_activity: new Date().toISOString() })
				.eq('id', code);

			// Save room code for session persistence
			localStorage.setItem('currentRoomCode', code);
			localStorage.setItem('roomCodeTimestamp', Date.now().toString());

			// Navigate to the room using the code
			toastComponent?.show('✓ Joining room...', 'success');
			await goto(`/lobby/${code}`);
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to join room';
			errorMessage = message;
			toastComponent?.show(message, 'error');
		} finally {
			isLoading = false;
		}
	}
</script>

<div class="mt-16 flex flex-col items-center justify-center md:mt-24">
	<div class="drop-shadow-l flex flex-row items-center justify-center">
		<span class="material-symbols-outlined flame-left mt-26 text-black dark:text-[#ffa843]"
			>local_fire_department</span>
		<span class="material-symbols-outlined mt-26 inline-block text-black dark:text-[#ffa843]"
			>local_fire_department</span>
		<span class="material-symbols-outlined flame-right mt-26 text-black dark:text-[#ffa843]"
			>local_fire_department</span>
	</div>

	<div class="mt-20 space-y-2">
		<p class="text-sans text-xs font-bold text-black dark:text-white">ROOM CODE</p>
		{#if errorMessage}
			<p class="text-sm text-red-500" transition:fade>{errorMessage}</p>
		{/if}
		{#if codeError}
			<p class="text-sm text-red-500" transition:fade>{codeError}</p>
		{/if}
		<input
			type="text"
			inputmode="numeric"
			bind:value={code}
			bind:this={codeInputRef}
			maxlength="4"
			placeholder="Enter 4 digit code..."
			on:blur={validateCode}
			class="h-20 w-72 rounded-xl border border-gray-300 bg-white px-4 text-gray-900 shadow-sm transition-all outline-none
                   placeholder:text-gray-400 focus:ring-2 focus:ring-orange-400 focus:ring-offset-2 dark:border-[#3a3a3a] dark:bg-[#2a2a2a] dark:text-white dark:shadow-[0_4px_4px_0_rgba(0,0,0,0.5)] dark:placeholder:text-[#606060]
                   {codeError ? 'border-2 border-red-500' : ''}"
			on:keydown={(e) => e.key === 'Enter' && handleJoin()} />
	</div>

	<button
		class="mt-11 cursor-pointer justify-center rounded-xl bg-[#ffa843] px-16 py-3
               font-sans text-[14px] font-bold tracking-widest text-white
               shadow-[0_4px_4px_0_rgba(0,0,0,0.25)] transition-all hover:bg-[#e38b2d]
               focus:ring-2 focus:ring-orange-400
               focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:shadow-[0_4px_4px_0_rgba(0,0,0,0.5)]"
		on:click={handleJoin}
		disabled={isLoading}
		type="button">
		{isLoading ? 'JOINING...' : 'JOIN'}
	</button>
</div>

<Toast bind:this={toastComponent} />

<style>
	/* Scale flames responsively */
	.material-symbols-outlined {
		font-size: clamp(120px, 30vw, 200px);
		z-index: 2;
	}
	.flame-left {
		font-size: clamp(60px, 14vw, 90px);
		transform: translateX(75%);
		z-index: 1;
	}
	.flame-right {
		font-size: clamp(60px, 14vw, 90px);
		transform: translateX(-75%);
		z-index: 1;
	}
</style>
