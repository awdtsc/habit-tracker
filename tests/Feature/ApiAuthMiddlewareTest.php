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
        // /api/habits は auth.api のため未認証は 401
        $this->getJson('/api/habits')
            ->assertStatus(401)
            ->assertJson(['message' => 'Unauthenticated.']);
    }


    #[Test]
    public function api_auth_state_is_public_but_reports_session_user()
    {
        // --- ログイン前は false ---
        $this->getJson('/api/auth/state')
            ->assertOk()
            ->assertJson([
                'authenticated' => false,
                'user' => null,
            ]);

        // --- ログイン実行 ---
        $user = User::factory()->createOne();

        $this->postJson('/login', [
            'email' => $user->email,
            'password' => 'password',
        ])->assertOk();

        // --- ログイン後は true ---
        $this->getJson('/api/auth/state')
            ->assertOk()
            ->assertJsonPath('authenticated', true)
            ->assertJsonPath('user.email', $user->email);
    }


    #[Test]
    public function sanctum_session_cookie_can_fetch_api_user()
    {
        $user = User::factory()->createOne();

        // ログイン成功 → Sanctum session cookie が付与される
        $this->postJson('/login', [
            'email' => $user->email,
            'password' => 'password',
        ])->assertOk();

        // /api/user は auth:sanctum で OK を返す
        $this->getJson('/api/user')
            ->assertOk()
            ->assertJsonPath('id', $user->id)
            ->assertJsonPath('email', $user->email);
    }
}
