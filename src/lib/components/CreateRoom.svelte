<script lang="ts">
	import { fade } from 'svelte/transition';
	import { supabase } from '$lib/supabaseClient';

	let showCreate = false;
	let title = '';
	let description = '';
	let username = '';

	function handleStart() {
		showCreate = true;
	}

	function handleClose() {
		showCreate = false;
	}

	async function handleCreate() {
		if (!title.trim()) {
			alert('Please add a title');
			return;
		}

		const { data, error } = await supabase
			.from('programs')
			.insert({ title, description })
			.select('id')
			.single();

		if (error) {
			alert("Wasn't able to create the program.");
			return;
		}
	}
</script>

<div class="mt-36 flex flex-col items-center justify-center">
	<span class="fire material-symbols-outlined mt-26 text-black">local_fire_department</span>

	<div class="mt-2 flex flex-col items-center justify-center">
		<h2 class="mt-9 font-sans text-[29px] font-bold tracking-wider text-black">OPEN PROGRAM</h2>
		<p class="mt-2 max-w-md text-center font-sans text-[14px] tracking-wider text-gray-500">
			Start an open program where <br />
			anyone can add songs & prayers
		</p>
		<button
			type="button"
			class="mt-11 cursor-pointer rounded-xl bg-black px-16 py-3 font-sans text-[14px] font-bold tracking-widest text-white shadow-[0_4px_4px_0_rgba(0,0,0,0.25)] hover:bg-gray-700"
			on:click={handleStart}>
			START
		</button>
	</div>
</div>

{#if showCreate}
	<div class="fixed inset-0 z-50 flex items-center justify-center">
		<button
			type="button"
			class="bg-opacity-25 bg-blur-sm absolute inset-0 backdrop-blur-sm"
			aria-label="Close modal"
			on:click={handleClose}></button>

		<div
			class="relative w-full max-w-[390px] rounded-2xl bg-white p-6 shadow-lg"
			in:fade={{ duration: 200 }}
			out:fade={{ duration: 150 }}>
			<header class="flex justify-end">
				<button type="button" class="text-2xl text-white hover:opacity-80" on:click={handleClose}>
					×
				</button>
			</header>

			<div class="mt-2 flex flex-col space-y-4">
				<label class="flex flex-col">
					<span class="text-sm font-medium text-orange-300">Program Title</span>
					<input
						type="text"
						placeholder="Enter a title…"
						bind:value={title}
						class="mt-1 w-full rounded-md border-2 border-white bg-transparent px-3 py-2 placeholder-orange-200 shadow-[0_4px_4px_0_rgba(0,0,0,0.25)] focus:border-blue-400 focus:outline-none" />
				</label>

				<label class="flex flex-col">
					<span class="text-sm font-medium text-orange-300">Description (optional)</span>
					<textarea
						rows="4"
						placeholder="Describe the program…"
						bind:value={description}
						class="mt-1 w-full rounded-md border-2 border-white bg-transparent px-3 py-2 placeholder-orange-200 shadow-[0_4px_4px_0_rgba(0,0,0,0.25)] focus:border-blue-400 focus:outline-none"
					></textarea>
				</label>

				<label class="flex flex-col">
					<span class="text-sm font-medium text-orange-300">Username</span>
					<input
						type="text"
						placeholder="Enter your username…"
						bind:value={username}
						class="mt-1 w-full rounded-md border-2 border-white bg-transparent px-3 py-2 placeholder-orange-200 shadow-[0_4px_4px_0_rgba(0,0,0,0.25)] focus:border-blue-400 focus:outline-none" />
				</label>
			</div>

			<div class="mt-6 flex justify-center">
				<button
					type="button"
					on:click={handleCreate}
					class="cursor-pointer rounded-full bg-[#ffa843] px-12 py-3 font-semibold text-white shadow-[0_4px_4px_0_rgba(0,0,0,0.25)] hover:bg-[#e38b2d]">
					Create
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.fire {
		font-size: 200px;
		z-index: 2;
	}
</style>
