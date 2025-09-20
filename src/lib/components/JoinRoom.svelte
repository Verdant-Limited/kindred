<script lang="ts">
	import { goto } from '$app/navigation';
	import { fade } from 'svelte/transition';
	import { supabase } from '$lib/supabaseClient';

	let code = '';
	let isLoading = false;
	let errorMessage = '';

	async function handleJoin() {
		try {
			errorMessage = '';

			if (!code.trim()) {
				errorMessage = 'Please enter a room code';
				return;
			}

			if (code.length !== 4) {
				errorMessage = 'Room code must be 4 digits';
				return;
			}

			if (!/^\d+$/.test(code)) {
				errorMessage = 'Room code must contain only numbers';
				return;
			}

			isLoading = true;

			// Query the correct table and field
			const { data: room, error } = await supabase
				.from('rooms') // Changed from 'programs' to 'rooms'
				.select('*') // Select all fields to get room data
				.eq('code', code) // Changed from 'id' to 'code')
				.single();

			if (error) {
				console.error('Supabase error:', error);
				if (error.code === 'PGRST116') {
					throw new Error('Room not found');
				}
				throw new Error('Failed to check room');
			}

			if (!room) {
				throw new Error('Room not found');
			}

			// Navigate to the room using the code
			await goto(`/lobby/${code}`);
		} catch (error) {
			console.error('Join error:', error);
			errorMessage = error instanceof Error ? error.message : 'Failed to join room';
		} finally {
			isLoading = false;
		}
	}
</script>

<div class="mt-24 flex flex-col items-center justify-center">
	<div class="drop-shadow-l flex flex-row items-center justify-center">
		<span class="material-symbols-outlined flame-left mt-26 text-black">local_fire_department</span>
		<span class="material-symbols-outlined mt-26 inline-block text-black"
			>local_fire_department</span>
		<span class="material-symbols-outlined flame-right mt-26 text-black"
			>local_fire_department</span>
	</div>

	<div class="mt-20 space-y-2">
		<p class="text-sans text-xs font-bold">ROOM CODE</p>
		{#if errorMessage}
			<p class="text-sm text-red-500" transition:fade>{errorMessage}</p>
		{/if}
		<input
			type="text"
			bind:value={code}
			maxlength="4"
			placeholder="Enter 4 digit code..."
			class="text-gray h-20 w-72 rounded-xl bg-stone-200 px-4 shadow-[0_4px_4px_0_rgba(0,0,0,0.25)]
                   drop-shadow-xl outline-none placeholder:text-gray-700
                   {errorMessage ? 'border-2 border-red-500' : ''}"
			on:keypress={(e) => e.key === 'Enter' && handleJoin()} />
	</div>

	<button
		class="mt-11 cursor-pointer justify-center rounded-xl bg-black px-16 py-3
               font-sans text-[14px] font-bold tracking-widest text-white
               shadow-[0_4px_4px_0_rgba(0,0,0,0.25)] hover:bg-gray-700
               disabled:cursor-not-allowed disabled:opacity-50"
		on:click={handleJoin}
		disabled={isLoading}
		type="button">
		{isLoading ? 'JOINING...' : 'JOIN'}
	</button>
</div>

<style>
	.material-symbols-outlined {
		font-size: 200px;
		z-index: 2;
	}
	.flame-left {
		font-size: 90px;
		transform: translateX(75%);
		z-index: 1;
	}
	.flame-right {
		font-size: 90px;
		transform: translateX(-75%);
		z-index: 1;
	}
</style>
