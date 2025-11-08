<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;

class ApiAuthMiddlewareTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function unauthenticated_requests_get_401_json()
    {
        $res = $this->getJson('/api/user');

        $res->assertStatus(401)
            ->assertJson(['message' => 'Unauthenticated.']);
    }

    #[Test]
    public function authenticated_requests_get_user_json()
    {
        /** @var \App\Models\User $user */
        $user = User::factory()->createOne();

        $res = $this->actingAs($user)
            ->getJson('/api/user');

        $res->assertOk()
            ->assertJsonPath('id', $user->id)
            ->assertJsonPath('email', $user->email);
    }
}

